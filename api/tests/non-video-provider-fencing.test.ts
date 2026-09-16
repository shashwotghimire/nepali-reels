import assert from "node:assert/strict";
import test from "node:test";
import ProviderUsage from "../src/models/provider-usage.model";
import type { BudgetAmounts } from "../src/helpers/phase2-budget.helper";
import type { ProviderBudgetContext } from "../src/services/pipeline/provider-budget.service";
import type { MeteringContext } from "../src/services/pipeline/llm-metering";
import type { VideoSpec } from "../src/schema/video-spec.schema";

process.env.GEMINI_API_KEY ??= "test-key";
process.env.OPENROUTER_API_KEY ??= "test-key";
process.env.BEDROCK_ACCESS_KEY_ID ??= "test-key";
process.env.BEDROCK_SECRET_ACCESS_KEY ??= "test-key";
process.env.BEDROCK_REGION ??= "us-east-1";
process.env.ELEVENLABS_API_KEY ??= "test-key";

type LedgerRow = Record<string, unknown>;

function mockLedger() {
  const rows = new Map<string, LedgerRow>();
  const originalFindOrCreate = ProviderUsage.findOrCreate;
  const originalUpdate = ProviderUsage.update;
  Object.assign(ProviderUsage, {
    findOrCreate: async ({ where, defaults }: {
      where: { attemptId: string };
      defaults: LedgerRow;
    }) => {
      const existing = rows.get(where.attemptId);
      if (existing) return [existing, false];
      const row = { ...defaults };
      rows.set(where.attemptId, row);
      return [row, true];
    },
    update: async (values: LedgerRow, options: { where: { attemptId: string } }) => {
      const row = rows.get(options.where.attemptId);
      if (!row) return [0];
      Object.assign(row, values);
      return [1];
    },
  });
  return {
    rows,
    restore() {
      Object.assign(ProviderUsage, {
        findOrCreate: originalFindOrCreate,
        update: originalUpdate,
      });
    },
  };
}

function meteringContext(assertOwned: () => Promise<void>) {
  let released = 0;
  let finalized = 0;
  const budget: ProviderBudgetContext = {
    reserve: async (reservationKey, _attempt, requested) => ({
      pipelineId: "22222222-2222-4222-8222-222222222222",
      userId: "user-1",
      reservationKey,
      reserved: requested,
    }),
    finalize: async () => { finalized += 1; },
    releaseBeforeStart: async () => { released += 1; },
  };
  const context: MeteringContext = {
    userId: "user-1",
    pipelineId: "22222222-2222-4222-8222-222222222222",
    stage: "test-stage",
    budget,
    lease: {
      stageAttemptId: "stage-attempt-1",
      leaseOwner: "old-worker",
      assertOwned,
    },
  };
  return { context, inspect: () => ({ released, finalized }) };
}

const lostLease = async () => {
  throw new Error("Workflow stage attempt is not owned by this worker");
};

test("stale Anthropic and Tavily stages make zero provider calls and release before start", async () => {
  const ledger = mockLedger();
  const { meteredAnthropicCall, meteredTavilySearch } =
    await import("../src/services/pipeline/llm-metering");
  let anthropicCalls = 0;
  let tavilyCalls = 0;
  const anthropic = meteringContext(lostLease);
  const tavily = meteringContext(lostLease);
  const requested: BudgetAmounts = { providerCalls: 1, inputTokens: 10, outputTokens: 10 };

  try {
    await assert.rejects(
      meteredAnthropicCall(
        anthropic.context,
        "script-writer",
        "model",
        async () => {
          anthropicCalls += 1;
          return { content: [], usage: { input_tokens: 0, output_tokens: 0 } };
        },
        requested,
      ),
      /not owned/,
    );
    await assert.rejects(
      meteredTavilySearch(tavily.context, "query", async () => {
        tavilyCalls += 1;
        return [];
      }),
      /not owned/,
    );

    assert.equal(anthropicCalls, 0);
    assert.equal(tavilyCalls, 0);
    assert.equal(anthropic.inspect().released, 1);
    assert.equal(tavily.inspect().released, 1);
    assert.equal(anthropic.inspect().finalized, 0);
    assert.equal(tavily.inspect().finalized, 0);
    assert.equal(ledger.rows.size, 2);
    for (const row of ledger.rows.values()) {
      assert.equal(row.status, "failed");
      assert.equal(row.costUsd, "0");
      assert.equal(row.costProvenance, "actual");
    }
  } finally {
    ledger.restore();
  }
});

test("Anthropic retries stop before a second provider call after lease takeover", async () => {
  const ledger = mockLedger();
  const { meteredAnthropicCall } = await import("../src/services/pipeline/llm-metering");
  let ownershipChecks = 0;
  let providerCalls = 0;
  const metering = meteringContext(async () => {
    ownershipChecks += 1;
    if (ownershipChecks > 1) await lostLease();
  });

  try {
    await assert.rejects(
      meteredAnthropicCall(
        metering.context,
        "script-writer",
        "model",
        async () => {
          providerCalls += 1;
          throw Object.assign(new Error("rate limited"), { status: 429 });
        },
        { providerCalls: 1 },
      ),
      /not owned/,
    );

    assert.equal(providerCalls, 1);
    assert.equal(ownershipChecks, 2);
    assert.equal(ledger.rows.size, 2);
    assert.equal([...ledger.rows.values()].filter((row) => row.status === "retried").length, 1);
    assert.equal([...ledger.rows.values()].filter((row) => row.costUsd === "0").length, 1);
    assert.equal(metering.inspect().finalized, 1);
    assert.equal(metering.inspect().released, 1);
  } finally {
    ledger.restore();
  }
});

test("stale TTS and forced-alignment stages make zero provider calls", async () => {
  const ledger = mockLedger();
  const [llmConfig, alignmentConfig, { generateTextToSpeechAgent }, { forcedAlignmentAgent }] =
    await Promise.all([
      import("../src/configs/llm.config"),
      import("../src/configs/elevenlabs.config"),
      import("../src/services/pipeline/agents/tts.agent"),
      import("../src/services/pipeline/agents/forced-alignment.agent"),
    ]);
  const originalTts = llmConfig.gClient.interactions.create;
  const originalAlignment = alignmentConfig.elevenLabsClient.forcedAlignment.create;
  let ttsCalls = 0;
  let alignmentCalls = 0;
  Object.assign(llmConfig.gClient.interactions, {
    create: async () => { ttsCalls += 1; return {}; },
  });
  Object.assign(alignmentConfig.elevenLabsClient.forcedAlignment, {
    create: async () => { alignmentCalls += 1; return { words: [] }; },
  });
  const tts = meteringContext(lostLease);
  const alignment = meteringContext(lostLease);
  const spec = {
    voiceoverText: "Hello",
    scenes: [{ captionText: "Hello" }],
    musicDirection: "",
    thumbnailText: "Hello",
  } as VideoSpec;

  try {
    await assert.rejects(generateTextToSpeechAgent(spec, "pipeline-1", "aoede", tts.context), /not owned/);
    await assert.rejects(forcedAlignmentAgent("/unused.wav", "Hello", alignment.context), /not owned/);
    assert.equal(ttsCalls, 0);
    assert.equal(alignmentCalls, 0);
    assert.equal(tts.inspect().released, 1);
    assert.equal(alignment.inspect().released, 1);
  } finally {
    Object.assign(llmConfig.gClient.interactions, { create: originalTts });
    Object.assign(alignmentConfig.elevenLabsClient.forcedAlignment, { create: originalAlignment });
    ledger.restore();
  }
});

test("thumbnail image generation is fenced when ownership changes after its prompt", async () => {
  const ledger = mockLedger();
  const [llmConfig, routerConfig, { generateThumbnailOpenRouter }] = await Promise.all([
    import("../src/configs/llm.config"),
    import("../src/configs/openrouter.config"),
    import("../src/services/pipeline/agents/thumbnail.agent"),
  ]);
  const originalPrompt = llmConfig.default.messages.create;
  const originalImage = routerConfig.openRouterClient.images.generate;
  let promptCalls = 0;
  let imageCalls = 0;
  let ownershipChecks = 0;
  Object.assign(llmConfig.default.messages, {
    create: async () => {
      promptCalls += 1;
      return {
        content: [{ type: "text", text: "image prompt" }],
        usage: { input_tokens: 10, output_tokens: 2 },
      };
    },
  });
  Object.assign(routerConfig.openRouterClient.images, {
    generate: async () => {
      imageCalls += 1;
      return { data: [{ b64Json: Buffer.from("image").toString("base64") }] };
    },
  });
  const metering = meteringContext(async () => {
    ownershipChecks += 1;
    if (ownershipChecks > 1) await lostLease();
  });
  const spec = {
    voiceoverText: "Hello",
    scenes: [{ captionText: "Hello" }],
    musicDirection: "",
    thumbnailText: "Hello",
  } as VideoSpec;

  try {
    await assert.rejects(
      generateThumbnailOpenRouter(spec, "prompt-model", "image-model", metering.context),
      /not owned/,
    );
    assert.equal(promptCalls, 1);
    assert.equal(imageCalls, 0);
    assert.equal(ownershipChecks, 2);
    assert.equal(metering.inspect().finalized, 1);
    assert.equal(metering.inspect().released, 1);
    const imageRow = [...ledger.rows.values()].find((row) => row.operation === "thumbnail_image");
    assert.equal(imageRow?.status, "failed");
    assert.equal(imageRow?.costUsd, "0");
  } finally {
    Object.assign(llmConfig.default.messages, { create: originalPrompt });
    Object.assign(routerConfig.openRouterClient.images, { generate: originalImage });
    ledger.restore();
  }
});
