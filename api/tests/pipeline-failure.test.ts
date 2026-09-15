import assert from "node:assert/strict";
import test from "node:test";
import Reels from "../src/models/reels.model";
import ProviderUsage from "../src/models/provider-usage.model";
import { markPipelineAsFailedService } from "../src/services/pipeline/pipeline-failure.service";

test("pipeline is marked failed when usage summary or cost save fails", async () => {
  const originalFindAll = ProviderUsage.findAll;
  const originalFindOne = Reels.findOne;
  const originalError = console.error;
  const failures: string[] = [];
  let saves = 0;
  const reel = {
    pipelineStatus: "queued",
    failureReason: null as string | null,
    legacyCostUsd: null,
    costUsd: null as number | null,
    costEstimateIncomplete: false,
    save: async () => { saves++; },
  };
  Object.assign(Reels, { findOne: async () => reel });
  console.error = (...args: unknown[]) => { failures.push(args.map(String).join(" ")); };
  try {
    Object.assign(ProviderUsage, { findAll: async () => { throw new Error("ledger unavailable"); } });
    await markPipelineAsFailedService("pipeline-1", "provider failed", "user-1");
    assert.equal(reel.pipelineStatus, "failed");
    assert.equal(reel.failureReason, "provider failed");
    assert.equal(saves, 1);
    assert.match(failures[0] ?? "", /ledger unavailable/);

    reel.pipelineStatus = "queued";
    Object.assign(ProviderUsage, { findAll: async () => [{ status: "succeeded", costUsd: "0.1" }] });
    reel.save = async () => {
      saves++;
      if (saves === 2) throw new Error("cost write failed");
    };
    await markPipelineAsFailedService("pipeline-1", "another failure", "user-1");
    assert.equal(reel.pipelineStatus, "failed");
    assert.equal(reel.failureReason, "another failure");
    assert.equal(saves, 3);
    assert.match(failures[1] ?? "", /cost write failed/);
  } finally {
    Object.assign(ProviderUsage, { findAll: originalFindAll });
    Object.assign(Reels, { findOne: originalFindOne });
    console.error = originalError;
  }
});
