import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateTtsTokenCost,
  estimateImageCost,
  generatedClipSeconds,
  calculateVideoCost,
} from "../src/utils/cost.util";
import { VIDEO_MODELS } from "../src/constants/constant";
import { extractLlmUsage, extractTtsUsage } from "../src/helpers/usage.helper";

test("Anthropic response usage parsing is provider-independent", () => {
  assert.deepEqual(extractLlmUsage({ usage: {
    input_tokens: 100,
    output_tokens: 25,
    cache_creation_input_tokens: 12,
    cache_read_input_tokens: 8,
  } }), {
    inputTokens: 100,
    outputTokens: 25,
    cacheWriteTokens: 12,
    cacheReadTokens: 8,
  });
  assert.deepEqual(extractLlmUsage({ usage: {
    input_tokens: 4,
    output_tokens: 2,
  } }), {
    inputTokens: 4,
    outputTokens: 2,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
  });
});

test("Gemini interaction response meters lowercase audio modality tokens", () => {
  const usage = extractTtsUsage({ usage: {
    total_input_tokens: 100,
    total_cached_tokens: 12,
    total_output_tokens: 900,
    output_tokens_by_modality: [
      { modality: "audio", tokens: 800 },
      { modality: "text", tokens: 100 },
    ],
  } });
  assert.deepEqual(usage, { inputTokens: 100, cacheReadTokens: 12, outputAudioTokens: 800 });
  assert.equal(estimateTtsTokenCost(usage.inputTokens, usage.outputAudioTokens,
    "gemini-3.1-flash-tts-preview"), 0.0161);
  assert.equal(extractTtsUsage({ usage: { total_input_tokens: 100 } }).outputAudioTokens, null);
});

test("Gemini audio modality without a valid token count keeps TTS cost unknown", () => {
  const model = "gemini-3.1-flash-tts-preview";
  for (const tokens of [undefined, "1500", Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    const audioPart = tokens === undefined
      ? { modality: "audio" }
      : { modality: "audio", tokens };
    const usage = extractTtsUsage({ usage: {
      total_input_tokens: 100,
      output_tokens_by_modality: [audioPart],
    } });
    assert.equal(usage.outputAudioTokens, null);
    assert.equal(estimateTtsTokenCost(usage.inputTokens, usage.outputAudioTokens, model), null);
  }

  const knownZero = extractTtsUsage({ usage: {
    total_input_tokens: 100,
    output_tokens_by_modality: [{ modality: "audio", tokens: 0 }],
  } });
  assert.equal(knownZero.outputAudioTokens, 0);
  assert.equal(estimateTtsTokenCost(knownZero.inputTokens, knownZero.outputAudioTokens, model), 0.0001);
});

test("TTS includes billed audio output rather than only text input", () => {
  assert.equal(estimateTtsTokenCost(1_000, 2_000, "gemini-3.1-flash-tts-preview"), 0.041);
  assert.equal(estimateTtsTokenCost(1_000, null, "gemini-3.1-flash-tts-preview"), null);
  assert.equal(estimateTtsTokenCost(1_000, 2_000, "unpriced-model"), null);
});

test("thumbnail estimate uses the actual model and leaves unpriced models unknown", () => {
  assert.equal(estimateImageCost(720, 1280, "google/gemini-3.1-flash-image"), null);
  assert.equal(estimateImageCost(720, 1280, "black-forest-labs/flux.2-pro"), 0.027648);
});

test("video estimate counts every rounded provider clip, not trimmed output", () => {
  const scenes = [
    { startSec: 0, endSec: 4.6 },
    { startSec: 4.6, endSec: 9.2 },
  ];
  const billedSeconds = generatedClipSeconds(scenes);
  assert.equal(billedSeconds, 10);
  assert.equal(calculateVideoCost(billedSeconds, VIDEO_MODELS["Seedance 1.5 Pro"]), 0.1153);
  assert.notEqual(calculateVideoCost(9.2, VIDEO_MODELS["Seedance 1.5 Pro"]), 0.1153);
});
