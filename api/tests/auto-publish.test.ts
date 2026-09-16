import assert from "node:assert/strict";
import test from "node:test";
import { attemptAutoPublish } from "../src/services/pipeline/auto-publish.service";

test("auto-publish failure does not fail an otherwise completed reel", async () => {
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(" ")); };
  try {
    const result = await attemptAutoPublish("pipeline-1", async () => {
      throw new Error("TikTok unavailable");
    });
    assert.deepEqual(result, { skipped: true, error: "TikTok unavailable" });
    assert.match(warnings[0] ?? "", /TikTok auto-publish skipped/);
  } finally {
    console.warn = originalWarn;
  }
});

test("auto-publish returns the provider publish ID on success", async () => {
  assert.deepEqual(
    await attemptAutoPublish("pipeline-1", async () => "publish-123"),
    { publishId: "publish-123" },
  );
});
