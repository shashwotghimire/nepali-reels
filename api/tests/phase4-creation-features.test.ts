import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PLAN_ENTITLEMENTS } from "../src/commercial/policy";
import { EnvironmentTestAccessResolver, resolveServerGenerationAccess } from "../src/services/pipeline/entitlement-resolution.service";
import { WorkflowAwaitingApprovalError, shouldMarkPipelineFailed } from "../src/services/pipeline/workflow-dispatcher.service";
import { renderBrandFrame, renderCaptionFrames } from "../src/helpers/subtitle-renderer";
import { dispatchPipelineService } from "../src/services/pipeline/pipeline.service";

test("approval pauses are not pipeline failures", () => {
  assert.equal(shouldMarkPipelineFailed(new WorkflowAwaitingApprovalError()), false);
  assert.equal(shouldMarkPipelineFailed(new Error("provider broke")), true);
});

test("commercial creation features match the locked entitlement matrix", () => {
  assert.deepEqual({ voices: PLAN_ENTITLEMENTS.trial.allSupportedVoices, captions: PLAN_ENTITLEMENTS.trial.captionPresets, revisions: PLAN_ENTITLEMENTS.trial.aiRevisionsPerVideo, thumbnails: PLAN_ENTITLEMENTS.trial.thumbnailsPerVideo }, { voices: false, captions: false, revisions: 1, thumbnails: 0 });
  assert.deepEqual({ styles: PLAN_ENTITLEMENTS.creator.styleSlots, revisions: PLAN_ENTITLEMENTS.creator.aiRevisionsPerVideo, regenerations: PLAN_ENTITLEMENTS.creator.thumbnailRegenerationsPerVideo }, { styles: 1, revisions: 2, regenerations: 0 });
  assert.deepEqual({ styles: PLAN_ENTITLEMENTS.plus.styleSlots, regenerations: PLAN_ENTITLEMENTS.plus.thumbnailRegenerationsPerVideo }, { styles: 3, regenerations: 2 });
});

test("test entitlements are server injected and production falls back to explicit legacy compatibility", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousGrants = process.env.PHASE4_TEST_ENTITLEMENTS;
  process.env.NODE_ENV = "test";
  process.env.PHASE4_TEST_ENTITLEMENTS = JSON.stringify({ alice: "plus" });
  assert.equal((await new EnvironmentTestAccessResolver().resolve("alice"))?.entitlement.id, "plus");
  assert.equal((await resolveServerGenerationAccess("unlisted")).accessKind, "legacy_compatibility");
  process.env.NODE_ENV = previousNodeEnv;
  if (previousGrants === undefined) delete process.env.PHASE4_TEST_ENTITLEMENTS; else process.env.PHASE4_TEST_ENTITLEMENTS = previousGrants;
});

test("caption presets and channel branding create distinct real composition frames", async () => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "phase4-render-"));
  try {
    const captions = [{ startSec: 0, endSec: 1, text: "नमस्ते नेपाल" }];
    const normal = await renderCaptionFrames(captions, path.join(dir, "normal"), "default").catch(async () => { await fs.promises.mkdir(path.join(dir, "normal")); return renderCaptionFrames(captions, path.join(dir, "normal"), "default"); });
    await fs.promises.mkdir(path.join(dir, "bold"));
    const bold = await renderCaptionFrames(captions, path.join(dir, "bold"), "bold");
    await fs.promises.mkdir(path.join(dir, "brand"));
    const brand = await renderBrandFrame({ channelName: "मेरो च्यानल", logoUrl: null }, path.join(dir, "brand"), 2);
    assert.notDeepEqual(await fs.promises.readFile(normal[0]!.pngPath), await fs.promises.readFile(bold[0]!.pngPath));
    assert.ok((await fs.promises.stat(brand.pngPath)).size > 1000);
    assert.deepEqual([brand.startSec, brand.endSec], [0, 2]);
  } finally { await fs.promises.rm(dir, { recursive: true, force: true }); }
});

test("Phase 4 migration persists approval, style, revision-idempotency and thumbnail version state", async () => {
  const migration = await fs.promises.readFile(new URL("../migrations/20260916000002-phase4-creation-features.js", import.meta.url), "utf8");
  for (const term of ["scriptApprovedAt", "scriptRevisionCount", "channel_styles", "script_revision_requests", "thumbnailVersions", "selectedThumbnailVersion"]) assert.match(migration, new RegExp(term));
});

test("persisted auto-publish intent survives approval resume while false remains false", async () => {
  const observed: boolean[] = [];
  const dependencies = {
    findPipeline: async (_id: string, userId: string) => ({ videoType: "explainer", autoPublishRequested: userId === "opted-in" }),
    runExplainer: async (input: { autoPublish: boolean }) => { observed.push(input.autoPublish); },
    runStory: async () => {}, runList: async () => {},
  };
  await dispatchPipelineService("opted-in", "reel-a", "approval-job", false, "lease-a", dependencies as never);
  await dispatchPipelineService("control", "reel-b", "approval-job", false, "lease-b", dependencies as never);
  assert.deepEqual(observed, [true, false]);
});
