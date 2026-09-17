import test from "node:test";
import assert from "node:assert/strict";
import sequelize from "../src/configs/db.config";
import User from "../src/models/users.model";
import Reels from "../src/models/reels.model";
import WorkflowStageAttempt from "../src/models/workflow-stage-attempt.model";
import WorkflowArtifact from "../src/models/workflow-artifact.model";
import ScriptRevisionRequest from "../src/models/script-revision-request.model";
import ThumbnailGenerationRequest from "../src/models/thumbnail-generation-request.model";
import ChannelStyle from "../src/models/channel-style.model";
import ProviderUsage from "../src/models/provider-usage.model";
import { reviseScriptService } from "../src/services/pipeline/script-approval.service";
import {
  approveCurrentScript, completeAiScriptRevision, completeThumbnailRegeneration,
  failThumbnailRegeneration, markAiRevisionSubmitted, markThumbnailRegenerationSubmitted,
  replaceReviewableScript, reserveAiScriptRevision, reserveThumbnailRegeneration,
  saveAiRevisionProviderResult, saveLinguisticReview, saveThumbnailRegenerationProviderResult,
  selectThumbnailVersion,
  abandonUncertainScriptRevision, markAiRevisionUncertain,
  findPhase4OperationIssues,
  failAiScriptRevision,
} from "../src/repositories/reels.repository";
import { reserveChannelStyleSlot } from "../src/repositories/channel-style.repository";

const enabled = Boolean(process.env.PHASE4_TEST_DATABASE_URL);

test("Phase 4 repository lifecycle, recovery, concurrency and monotonic versions", { skip: !enabled }, async () => {
  await sequelize.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await User.sync(); await Reels.sync(); await WorkflowStageAttempt.sync(); await WorkflowArtifact.sync();
  await ScriptRevisionRequest.sync(); await ThumbnailGenerationRequest.sync(); await ChannelStyle.sync(); await ProviderUsage.sync();
  await User.create({ id: "phase4-user", name: "Test", email: "phase4@example.test", emailVerified: true, image: null, createdAt: new Date(), updatedAt: new Date() });
  const script = { value: "reviewed" };
  const reel = await Reels.create({ userId: "phase4-user", topic: "topic", claudeModel: "model", videoModel: "video", videoType: "explainer", contentInput: { videoType: "explainer" }, workflowVersion: 1, draftScript: script, finalScript: script, pipelineStatus: "script_finalised" });

  // Explainer cannot expose approval/edit while linguistic review is in flight.
  await assert.rejects(approveCurrentScript(reel.id, reel.userId, 1), /not editable/);
  await assert.rejects(replaceReviewableScript({ pipelineId: reel.id, userId: reel.userId, expectedVersion: 1, script: { value: "edit" } }), /not editable/);
  await saveLinguisticReview(reel.id, reel.userId, { value: "linguistic" } as never, undefined, 1);
  await approveCurrentScript(reel.id, reel.userId, 1);

  for (const videoType of ["story", "list"] as const) {
    const structured = await Reels.create({ userId: reel.userId, topic: videoType, claudeModel: "model", videoModel: "video", videoType, contentInput: videoType === "story" ? { videoType, storyInput: { treatment: "fictional" } } : { videoType, listInput: { itemCount: 3, order: "ascending" } }, workflowVersion: 1, finalScript: { value: videoType }, pipelineStatus: "awaiting_script_approval" });
    await approveCurrentScript(structured.id, structured.userId, 1); await structured.reload();
    assert.ok(structured.scriptApprovedAt);
  }

  // A revision that somehow loses the approval race cannot mutate a rendered reel.
  await reel.reload(); reel.pipelineStatus = "awaiting_script_approval"; reel.scriptApprovedAt = null; reel.approvedScriptFingerprint = null; await reel.save();
  const late = await reserveAiScriptRevision({ pipelineId: reel.id, userId: reel.userId, idempotencyKey: "late", expectedVersion: 1, instruction: "late", limit: 2 });
  assert.equal(late.state, "reserved");
  if (late.state !== "reserved") throw new Error("expected reservation");
  await markAiRevisionSubmitted(reel.id, reel.userId, "late", late.leaseOwner);
  await saveAiRevisionProviderResult(reel.id, reel.userId, "late", late.leaseOwner, { value: "late result" });
  assert.equal((await reserveAiScriptRevision({ pipelineId: reel.id, userId: reel.userId, idempotencyKey: "late", expectedVersion: 1, instruction: "late", limit: 2 })).state, "provider_succeeded");
  await reel.reload(); reel.pipelineStatus = "video_generated"; reel.s3key = "videos/original.mp4"; reel.videoSpec = { keep: true }; await reel.save();
  await assert.rejects(completeAiScriptRevision({ pipelineId: reel.id, userId: reel.userId, idempotencyKey: "late", expectedVersion: 1, script: { value: "late result" }, leaseOwner: late.leaseOwner }), /not editable/);
  await reel.reload(); assert.equal((reel.finalScript as { value: string }).value, "linguistic"); assert.deepEqual(reel.videoSpec, { keep: true }); assert.equal(reel.s3key, "videos/original.mp4");

  // Submitted requests are never blindly replayed; acknowledging uncertainty unblocks lifecycle while retaining usage.
  const uncertainReel = await Reels.create({ userId: reel.userId, topic: "uncertain", claudeModel: "model", videoModel: "video", videoType: "explainer", contentInput: { videoType: "explainer" }, workflowVersion: 1, finalScript: script, pipelineStatus: "awaiting_script_approval" });
  const uncertain = await reserveAiScriptRevision({ pipelineId: uncertainReel.id, userId: reel.userId, idempotencyKey: "uncertain", expectedVersion: 1, instruction: "uncertain", limit: 2 });
  if (uncertain.state !== "reserved") throw new Error("expected uncertain reservation");
  await markAiRevisionSubmitted(uncertainReel.id, reel.userId, "uncertain", uncertain.leaseOwner);
  await markAiRevisionUncertain(uncertainReel.id, reel.userId, "uncertain", uncertain.leaseOwner, "connection lost");
  assert.equal((await reserveAiScriptRevision({ pipelineId: uncertainReel.id, userId: reel.userId, idempotencyKey: "uncertain", expectedVersion: 1, instruction: "uncertain", limit: 2 })).state, "uncertain");
  await assert.rejects(approveCurrentScript(uncertainReel.id, reel.userId, 1), /still active/);
  await abandonUncertainScriptRevision(uncertainReel.id, reel.userId, "uncertain");
  assert.equal((await reserveAiScriptRevision({ pipelineId: uncertainReel.id, userId: reel.userId, idempotencyKey: "uncertain", expectedVersion: 1, instruction: "uncertain", limit: 2 })).state, "consumed");
  await approveCurrentScript(uncertainReel.id, reel.userId, 1);

  // Same-key replay during a live provider call cannot mutate or steal its request.
  const activeReel = await Reels.create({ userId: reel.userId, topic: "active", claudeModel: "model", videoModel: "video", videoType: "explainer", contentInput: { videoType: "explainer" }, workflowVersion: 1, finalScript: script, pipelineStatus: "awaiting_script_approval" });
  const active = await reserveAiScriptRevision({ pipelineId: activeReel.id, userId: reel.userId, idempotencyKey: "active", expectedVersion: 1, instruction: "active", limit: 2 });
  if (active.state !== "reserved") throw new Error("expected active reservation");
  await markAiRevisionSubmitted(activeReel.id, reel.userId, "active", active.leaseOwner);
  assert.equal((await reserveAiScriptRevision({ pipelineId: activeReel.id, userId: reel.userId, idempotencyKey: "active", expectedVersion: 1, instruction: "active", limit: 2 })).state, "running");
  await assert.rejects(reserveAiScriptRevision({ pipelineId: activeReel.id, userId: reel.userId, idempotencyKey: "active", expectedVersion: 1, instruction: "different payload", limit: 2 }), /payload conflict/);
  await saveAiRevisionProviderResult(activeReel.id, reel.userId, "active", active.leaseOwner, { value: "active result" });
  await completeAiScriptRevision({ pipelineId: activeReel.id, userId: reel.userId, idempotencyKey: "active", expectedVersion: 1, script: { value: "active result" }, leaseOwner: active.leaseOwner });

  // The service boundary also makes exactly one provider call for a live same-key replay.
  process.env.PHASE4_TEST_ENTITLEMENTS = JSON.stringify({ [reel.userId]: "plus" });
  const validScript = {
    hookOptions: [{ text: "a", style: "question" }, { text: "b", style: "shock" }, { text: "c", style: "story" }],
    selectedHook: "a", narrationNp: "कथा", shotPlan: [0, 1, 2].map((index) => ({ index, durationSec: 4, visual: "scene", cameraOrMotion: "still" })),
    onScreenText: [], captions: [{ startSec: 0, endSec: 4, text: "a" }, { startSec: 4, endSec: 8, text: "b" }, { startSec: 8, endSec: 12, text: "c" }],
    titleOptions: ["a", "b"], hashtags: ["a", "b", "c"], platformDescription: "a", estDurationSec: 12,
  };
  const serviceReel = await Reels.create({ userId: reel.userId, topic: "service", claudeModel: "model", videoModel: "video", videoType: "explainer", contentInput: { videoType: "explainer" }, workflowVersion: 1, finalScript: validScript, pipelineStatus: "awaiting_script_approval" });
  let providerCalls = 0; let releaseProvider!: () => void; let providerEntered!: () => void;
  const entered = new Promise<void>((resolve) => { providerEntered = resolve; });
  const release = new Promise<void>((resolve) => { releaseProvider = resolve; });
  const generator = { revise: async () => { providerCalls += 1; providerEntered(); await release; return validScript; } };
  const serviceFirst = reviseScriptService(reel.userId, serviceReel.id, { expectedVersion: 1, instruction: "service", idempotencyKey: "service-key" }, generator);
  await entered;
  await assert.rejects(reviseScriptService(reel.userId, serviceReel.id, { expectedVersion: 1, instruction: "service", idempotencyKey: "service-key" }, generator), /already running/);
  releaseProvider(); await serviceFirst;
  assert.equal(providerCalls, 1);

  // Reload discovery can resume an expired reservation and a durable provider result.
  const expiredReel = await Reels.create({ userId: reel.userId, topic: "expired", claudeModel: "model", videoModel: "video", videoType: "explainer", contentInput: { videoType: "explainer" }, workflowVersion: 1, finalScript: validScript, pipelineStatus: "awaiting_script_approval" });
  await reserveAiScriptRevision({ pipelineId: expiredReel.id, userId: reel.userId, idempotencyKey: "expired-key", expectedVersion: 1, instruction: "expired", limit: 2 });
  await ScriptRevisionRequest.update({ leaseExpiresAt: new Date(0) }, { where: { pipelineId: expiredReel.id, idempotencyKey: "expired-key" } });
  const expiredIssues = await findPhase4OperationIssues(expiredReel.id, reel.userId);
  assert.deepEqual(expiredIssues.map(({ status, idempotencyKey }) => [status, idempotencyKey]), [["reserved", "expired-key"]]);
  await reviseScriptService(reel.userId, expiredReel.id, { expectedVersion: 1, instruction: "expired", idempotencyKey: "expired-key" }, { revise: async () => validScript });

  const savedReel = await Reels.create({ userId: reel.userId, topic: "saved", claudeModel: "model", videoModel: "video", videoType: "explainer", contentInput: { videoType: "explainer" }, workflowVersion: 1, finalScript: validScript, pipelineStatus: "awaiting_script_approval" });
  const saved = await reserveAiScriptRevision({ pipelineId: savedReel.id, userId: reel.userId, idempotencyKey: "saved-key", expectedVersion: 1, instruction: "saved", limit: 2 });
  if (saved.state !== "reserved") throw new Error("expected saved reservation");
  await markAiRevisionSubmitted(savedReel.id, reel.userId, "saved-key", saved.leaseOwner);
  await saveAiRevisionProviderResult(savedReel.id, reel.userId, "saved-key", saved.leaseOwner, validScript);
  assert.equal((await findPhase4OperationIssues(savedReel.id, reel.userId))[0]?.status, "provider_succeeded");
  let replayProviderCalls = 0;
  await reviseScriptService(reel.userId, savedReel.id, { expectedVersion: 1, instruction: "saved", idempotencyKey: "saved-key" }, { revise: async () => { replayProviderCalls += 1; return validScript; } });
  assert.equal(replayProviderCalls, 0);
  delete process.env.PHASE4_TEST_ENTITLEMENTS;

  // A second key cannot reserve or spend for the same script version.
  const serialReel = await Reels.create({ userId: reel.userId, topic: "serial", claudeModel: "model", videoModel: "video", videoType: "explainer", contentInput: { videoType: "explainer" }, workflowVersion: 1, finalScript: script, pipelineStatus: "awaiting_script_approval" });
  await reserveAiScriptRevision({ pipelineId: serialReel.id, userId: reel.userId, idempotencyKey: "serial-a", expectedVersion: 1, instruction: "one", limit: 2 });
  await assert.rejects(reserveAiScriptRevision({ pipelineId: serialReel.id, userId: reel.userId, idempotencyKey: "serial-b", expectedVersion: 1, instruction: "two", limit: 2 }), /already active/);
  await serialReel.reload(); assert.equal(serialReel.scriptRevisionCount, 1);

  const recoverable = await Reels.create({ userId: reel.userId, topic: "recoverable", claudeModel: "model", videoModel: "video", videoType: "explainer", contentInput: { videoType: "explainer" }, workflowVersion: 1, finalScript: script, pipelineStatus: "awaiting_script_approval" });
  const first = await reserveAiScriptRevision({ pipelineId: recoverable.id, userId: reel.userId, idempotencyKey: "recover", expectedVersion: 1, instruction: "recover", limit: 1 });
  if (first.state !== "reserved") throw new Error("expected initial reservation");
  await ScriptRevisionRequest.update({ leaseExpiresAt: new Date(0) }, { where: { pipelineId: recoverable.id, idempotencyKey: "recover" } });
  const takeover = await reserveAiScriptRevision({ pipelineId: recoverable.id, userId: reel.userId, idempotencyKey: "recover", expectedVersion: 1, instruction: "recover", limit: 1 });
  assert.equal(takeover.state, "reserved"); if (takeover.state !== "reserved") throw new Error("expected safe takeover");
  assert.notEqual(takeover.leaseOwner, first.leaseOwner);
  await failAiScriptRevision(recoverable.id, reel.userId, "recover", first.leaseOwner);
  await markAiRevisionSubmitted(recoverable.id, reel.userId, "recover", takeover.leaseOwner);
  await saveAiRevisionProviderResult(recoverable.id, reel.userId, "recover", takeover.leaseOwner, { value: "recovered" });
  assert.equal((await reserveAiScriptRevision({ pipelineId: recoverable.id, userId: reel.userId, idempotencyKey: "recover", expectedVersion: 1, instruction: "recover", limit: 1 })).state, "provider_succeeded");
  await completeAiScriptRevision({ pipelineId: recoverable.id, userId: reel.userId, idempotencyKey: "recover", expectedVersion: 1, script: { value: "recovered" }, leaseOwner: takeover.leaseOwner });
  assert.equal((await reserveAiScriptRevision({ pipelineId: recoverable.id, userId: reel.userId, idempotencyKey: "recover", expectedVersion: 1, instruction: "recover", limit: 1 })).state, "completed");
  await assert.rejects(reserveAiScriptRevision({ pipelineId: recoverable.id, userId: reel.userId, idempotencyKey: "extra", expectedVersion: 2, instruction: "extra", limit: 1 }), /limit reached/);

  const activeThumbnailReel = await Reels.create({ userId: reel.userId, topic: "active thumbnail", claudeModel: "model", videoModel: "video", videoType: "explainer", contentInput: { videoType: "explainer" }, workflowVersion: 1, finalScript: script, videoSpec: { scenes: [] }, pipelineStatus: "video_generated", s3key: "videos/active.mp4", thumbnailUrl: "https://asset/thumb-v1.jpg", thumbnailVersions: [{ version: 1, url: "https://asset/thumb-v1.jpg", artifactKey: "v1" }] });
  const activeThumbnail = await reserveThumbnailRegeneration({ pipelineId: activeThumbnailReel.id, userId: reel.userId, idempotencyKey: "active-thumbnail", limit: 2 });
  if (activeThumbnail.state !== "reserved") throw new Error("expected thumbnail reservation");
  await markThumbnailRegenerationSubmitted(activeThumbnailReel.id, reel.userId, "active-thumbnail", activeThumbnail.leaseOwner);
  assert.equal((await reserveThumbnailRegeneration({ pipelineId: activeThumbnailReel.id, userId: reel.userId, idempotencyKey: "active-thumbnail", limit: 2 })).state, "running");
  await saveThumbnailRegenerationProviderResult(activeThumbnailReel.id, reel.userId, "active-thumbnail", activeThumbnail.leaseOwner, "https://asset/thumb-v2.jpg");
  await completeThumbnailRegeneration({ pipelineId: activeThumbnailReel.id, userId: reel.userId, idempotencyKey: "active-thumbnail", leaseOwner: activeThumbnail.leaseOwner });

  // Thumbnail versions remain unique after an earlier concurrent request fails.
  reel.thumbnailUrl = "https://asset/v1.jpg"; reel.thumbnailVersions = [{ version: 1, url: reel.thumbnailUrl, artifactKey: "v1" }]; reel.selectedThumbnailVersion = 1; reel.nextThumbnailVersion = 2; await reel.save();
  const a = await reserveThumbnailRegeneration({ pipelineId: reel.id, userId: reel.userId, idempotencyKey: "a", limit: 2 });
  const b = await reserveThumbnailRegeneration({ pipelineId: reel.id, userId: reel.userId, idempotencyKey: "b", limit: 2 });
  assert.equal(a.state, "reserved"); assert.equal(b.state, "reserved");
  if (a.state !== "reserved" || b.state !== "reserved") throw new Error("expected reservations");
  await failThumbnailRegeneration(reel.id, reel.userId, "a", a.leaseOwner, "definite failure");
  const c = await reserveThumbnailRegeneration({ pipelineId: reel.id, userId: reel.userId, idempotencyKey: "c", limit: 2 });
  assert.equal(c.state, "reserved"); if (c.state !== "reserved") throw new Error("expected replacement reservation");
  assert.deepEqual([a.version, b.version, c.version], [2, 3, 4]);
  await markThumbnailRegenerationSubmitted(reel.id, reel.userId, "c", c.leaseOwner);
  await saveThumbnailRegenerationProviderResult(reel.id, reel.userId, "c", c.leaseOwner, "https://asset/v4.jpg");
  await completeThumbnailRegeneration({ pipelineId: reel.id, userId: reel.userId, idempotencyKey: "c", leaseOwner: c.leaseOwner });
  await markThumbnailRegenerationSubmitted(reel.id, reel.userId, "b", b.leaseOwner);
  await saveThumbnailRegenerationProviderResult(reel.id, reel.userId, "b", b.leaseOwner, "https://asset/v3.jpg");
  await completeThumbnailRegeneration({ pipelineId: reel.id, userId: reel.userId, idempotencyKey: "b", leaseOwner: b.leaseOwner });
  await selectThumbnailVersion(reel.id, reel.userId, 4); await reel.reload();
  assert.deepEqual(reel.thumbnailVersions?.map(({ version, url }) => [version, url]), [[1, "https://asset/v1.jpg"], [4, "https://asset/v4.jpg"], [3, "https://asset/v3.jpg"]]);
  assert.equal(reel.thumbnailUrl, "https://asset/v4.jpg");
  assert.equal((await reserveThumbnailRegeneration({ pipelineId: reel.id, userId: reel.userId, idempotencyKey: "c", limit: 2 })).state, "completed");
  await assert.rejects(reserveThumbnailRegeneration({ pipelineId: reel.id, userId: reel.userId, idempotencyKey: "d", limit: 2 }), /limit reached/);

  // Locking the user row enforces a single Creator style slot under concurrency.
  const styleResults = await Promise.allSettled([
    reserveChannelStyleSlot({ id: crypto.randomUUID(), userId: reel.userId, name: "one", channelName: "One", captionPreset: "default", limit: 1 }),
    reserveChannelStyleSlot({ id: crypto.randomUUID(), userId: reel.userId, name: "two", channelName: "Two", captionPreset: "bold", limit: 1 }),
  ]);
  assert.equal(styleResults.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(styleResults.filter((result) => result.status === "rejected").length, 1);

  await sequelize.close();
});
