import assert from "node:assert/strict";
import test from "node:test";
import { CLAUDE_MODELS, VIDEO_MODELS } from "../src/constants/constant";
import { COST_BUDGET_POLICY, PLAN_ENTITLEMENTS, STANDARD_GENERATION } from "../src/commercial/policy";

test("commercial entitlements encode the approved quotas and NPR minor-unit prices", () => {
  assert.deepEqual(Object.keys(PLAN_ENTITLEMENTS), ["trial", "creator", "plus"]);
  assert.equal(PLAN_ENTITLEMENTS.trial.requiresVerifiedAccount, true);
  assert.equal(PLAN_ENTITLEMENTS.trial.quotaPeriod, "lifetime");
  assert.equal(PLAN_ENTITLEMENTS.trial.videosPerPeriod, 1);
  assert.equal(PLAN_ENTITLEMENTS.trial.maxOutputDurationSeconds, 30);
  assert.equal(PLAN_ENTITLEMENTS.trial.aiRevisionsPerVideo, 1);
  assert.equal(PLAN_ENTITLEMENTS.trial.thumbnailsPerVideo, 0);
  assert.equal(PLAN_ENTITLEMENTS.creator.priceNprMinor, 149_900);
  assert.equal(PLAN_ENTITLEMENTS.creator.videosPerPeriod, 2);
  assert.equal(PLAN_ENTITLEMENTS.creator.maxOutputDurationSeconds, 75);
  assert.equal(PLAN_ENTITLEMENTS.creator.aiRevisionsPerVideo, 2);
  assert.equal(PLAN_ENTITLEMENTS.creator.thumbnailsPerVideo, 1);
  assert.equal(PLAN_ENTITLEMENTS.creator.thumbnailRegenerationsPerVideo, 0);
  assert.equal(PLAN_ENTITLEMENTS.plus.priceNprMinor, 349_900);
  assert.equal(PLAN_ENTITLEMENTS.plus.videosPerPeriod, 4);
  assert.equal(PLAN_ENTITLEMENTS.plus.styleSlots, 3);
  assert.equal(PLAN_ENTITLEMENTS.plus.thumbnailRegenerationsPerVideo, 2);
});

test("standard generation uses the configured provider models and aggregate planning ceiling", () => {
  assert.equal(STANDARD_GENERATION.scriptModel, CLAUDE_MODELS["Sonnet 4.5"]);
  assert.equal(STANDARD_GENERATION.videoModel, VIDEO_MODELS["Seedance 1.5 Pro"]);
  assert.equal(STANDARD_GENERATION.videoResolution, "480p");
  assert.equal(STANDARD_GENERATION.videoNativeAudio, false);
  assert.equal(STANDARD_GENERATION.maxGeneratedVideoSeconds, 90);
});

test("budget assumptions cover aggregate variable-cost work without activating enforcement", () => {
  assert.equal(COST_BUDGET_POLICY.enforcement, "inactive");
  assert.deepEqual(COST_BUDGET_POLICY.perVideoTargetNpr, { creator: 375, plus: 425 });
  assert.deepEqual(COST_BUDGET_POLICY.aggregatePlanningCeilings, {
    llmInputTokens: 60_000,
    llmOutputTokens: 20_000,
    generatedVideoSeconds: 90,
  });
  assert.equal(COST_BUDGET_POLICY.retryReserveFraction, 0.25);
  assert.equal(COST_BUDGET_POLICY.paymentFeeFraction, 0.05);
  assert.equal(COST_BUDGET_POLICY.nprPerUsd, 160);
  assert.ok(COST_BUDGET_POLICY.coveredWork.includes("research_searches"));
  assert.ok(COST_BUDGET_POLICY.coveredWork.includes("ai_revisions"));
  assert.ok(COST_BUDGET_POLICY.coveredWork.includes("provider_retries"));
});
