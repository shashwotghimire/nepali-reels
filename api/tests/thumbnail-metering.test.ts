import assert from "node:assert/strict";
import test from "node:test";
import ProviderUsage from "../src/models/provider-usage.model";
import { CLAUDE_MODELS } from "../src/constants/constant";
import type { VideoSpec } from "../src/schema/video-spec.schema";

test("thumbnail prompt retry creates a separate attempt for each provider invocation", async () => {
  process.env.GEMINI_API_KEY ??= "test-key";
  process.env.OPENROUTER_API_KEY ??= "test-key";
  process.env.BEDROCK_ACCESS_KEY_ID ??= "test-key";
  process.env.BEDROCK_SECRET_ACCESS_KEY ??= "test-key";
  process.env.BEDROCK_REGION ??= "us-east-1";
  const [{ default: client }, { openRouterClient }, { generateThumbnailOpenRouter }] =
    await Promise.all([
      import("../src/configs/llm.config"),
      import("../src/configs/openrouter.config"),
      import("../src/services/pipeline/agents/thumbnail.agent"),
    ]);
  const rows = new Map<string, Record<string, unknown>>();
  const originalCreate = client.messages.create;
  const originalGenerate = openRouterClient.images.generate;
  const originalFindOrCreate = ProviderUsage.findOrCreate;
  const originalUpdate = ProviderUsage.update;
  const retryOptions: unknown[] = [];
  let promptCalls = 0;

  Object.assign(client.messages, {
    create: async (_request: unknown, options: unknown) => {
      retryOptions.push(options);
      if (++promptCalls === 1) throw Object.assign(new Error("rate limited"), { status: 429 });
      return {
        content: [{ type: "text", text: "An image prompt" }],
        usage: { input_tokens: 100, output_tokens: 20 },
      };
    },
  });
  Object.assign(openRouterClient.images, {
    generate: async () => ({ data: [{ b64Json: Buffer.from("image").toString("base64") }] }),
  });
  Object.assign(ProviderUsage, {
    findOrCreate: async ({ where, defaults }: { where: { attemptId: string }; defaults: Record<string, unknown> }) => {
      const existing = rows.get(where.attemptId);
      if (existing) return [existing, false];
      const row = { ...defaults };
      rows.set(where.attemptId, row);
      return [row, true];
    },
    update: async (values: Record<string, unknown>, options: { where: { attemptId: string } }) => {
      const row = rows.get(options.where.attemptId);
      if (!row) return [0];
      Object.assign(row, values);
      return [1];
    },
  });

  try {
    const spec = {
      voiceoverText: "Hello", scenes: [{ captionText: "Hello" }],
      musicDirection: "", thumbnailText: "Hello",
    } as VideoSpec;
    await generateThumbnailOpenRouter(spec, CLAUDE_MODELS["Sonnet 4.5"],
      "google/gemini-3.1-flash-image",
      { userId: "user-1", pipelineId: "22222222-2222-4222-8222-222222222222", stage: "thumbnail" });

    const promptRows = [...rows.values()].filter((row) => row.operation === "thumbnail_prompt");
    assert.equal(promptCalls, 2);
    assert.deepEqual(retryOptions, [{ maxRetries: 0 }, { maxRetries: 0 }]);
    assert.equal(promptRows.length, 2);
    assert.equal(promptRows.filter((row) => row.status === "retried").length, 1);
    assert.equal(promptRows.filter((row) => row.status === "succeeded").length, 1);
    const retried = promptRows.find((row) => row.status === "retried")!;
    const succeeded = promptRows.find((row) => row.status === "succeeded")!;
    assert.equal(succeeded.retryOfAttemptId, retried.attemptId);
    assert.equal(succeeded.inputTokens, 100);
    assert.equal(rows.size, 3); // two prompt invocations and one image invocation
  } finally {
    Object.assign(client.messages, { create: originalCreate });
    Object.assign(openRouterClient.images, { generate: originalGenerate });
    Object.assign(ProviderUsage, { findOrCreate: originalFindOrCreate, update: originalUpdate });
  }
});
