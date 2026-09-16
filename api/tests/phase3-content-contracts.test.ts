import assert from "node:assert/strict";
import test from "node:test";
import {
  validateListScript,
  validateListVideoSpec,
  validateStoryScript,
  validateStoryVideoSpec,
} from "../src/helpers/phase3-content-validation.helper";
import { generateScriptBodySchema } from "../src/validations/pipeline.validation";
import { buildCompositionOverlays } from "../src/helpers/composition-overlay.helper";
import {
  factualStoryInput,
  factualStoryScript,
  factualStoryVideoSpec,
  fictionalStoryInput,
  fictionalStoryScript,
  listInput,
  listScript,
  listVideoSpec,
} from "./fixtures/phase3-content.fixture";

test("factual and fictional stories keep their treatment and continuity contracts", () => {
  assert.doesNotThrow(() => validateStoryScript(factualStoryInput, factualStoryScript, 74));
  assert.doesNotThrow(() => validateStoryVideoSpec(factualStoryInput, factualStoryVideoSpec, 74));
  assert.doesNotThrow(() => validateStoryScript(fictionalStoryInput, fictionalStoryScript, 74));
  assert.doesNotThrow(() => validateStoryVideoSpec(fictionalStoryInput, {
    ...factualStoryVideoSpec,
    treatment: "fictional",
    voiceoverText: fictionalStoryScript.narrationNp,
  }, 74, fictionalStoryScript.disclosureNp));
  assert.throws(
    () => validateStoryScript(fictionalStoryInput, { ...fictionalStoryScript, disclosureNp: "कथा" }, 74),
    /fictional disclosure/,
  );
  assert.throws(
    () => validateStoryScript(fictionalStoryInput, {
      ...fictionalStoryScript,
      narrationNp: fictionalStoryScript.selectedHook,
    }, 74),
    /narration must include its disclosure/,
  );
  assert.throws(
    () => validateStoryVideoSpec(fictionalStoryInput, {
      ...factualStoryVideoSpec,
      treatment: "fictional",
      voiceoverText: "घण्टीको आवाज आयो।",
    }, 74, fictionalStoryScript.disclosureNp),
    /voiceover must retain/,
  );
  assert.throws(
    () => validateStoryVideoSpec(factualStoryInput, {
      ...factualStoryVideoSpec,
      scenes: factualStoryVideoSpec.scenes.map((scene, index) => index === 1
        ? { ...scene, characterIds: ["changed-character"] }
        : scene),
    }, 74),
    /unknown character/,
  );
});

test("list contracts preserve exact count, direction, numbering and scene composition", () => {
  assert.doesNotThrow(() => validateListScript(listInput, listScript, 74));
  assert.doesNotThrow(() => validateListVideoSpec(listInput, listVideoSpec, 74));
  assert.deepEqual(
    buildCompositionOverlays(listVideoSpec.scenes).map((overlay) => overlay.text),
    ["3 · स्थान ३", "2 · स्थान २", "1 · स्थान १"],
  );
  assert.throws(
    () => validateListScript(listInput, {
      ...listScript,
      items: listScript.items.map((item, index) => index === 1 ? { ...item, number: 1 } : item),
    }, 74),
    /numbering must be 3, 2, 1/,
  );
  assert.throws(
    () => validateListVideoSpec(listInput, {
      ...listVideoSpec,
      scenes: listVideoSpec.scenes.map((scene, index) => index === 2
        ? { ...scene, startSec: scene.startSec + 1, endSec: scene.endSec + 1 }
        : scene),
    }, 74),
    /contiguous/,
  );
  assert.throws(
    () => validateListVideoSpec(listInput, {
      ...listVideoSpec,
      scenes: listVideoSpec.scenes.map((scene, index) => index === 1
        ? { ...scene, onScreenText: "स्थान" }
        : scene),
    }, 74),
    /display item number 3/,
  );
});

test("creation request schema is discriminated and preserves Explainer compatibility", () => {
  assert.equal(generateScriptBodySchema.parse({ topic: "A valid legacy topic" }).videoType, "explainer");
  assert.equal(generateScriptBodySchema.parse({
    topic: "A factual story", videoType: "story", storyInput: factualStoryInput,
  }).videoType, "story");
  assert.equal(generateScriptBodySchema.parse({
    topic: "A countdown", videoType: "list", listInput,
  }).videoType, "list");
  assert.throws(() => generateScriptBodySchema.parse({ topic: "Missing config", videoType: "story" }));
  assert.throws(() => generateScriptBodySchema.parse({
    topic: "Wrong config", videoType: "list", storyInput: factualStoryInput,
  }));
  assert.throws(() => generateScriptBodySchema.parse({
    topic: "Ambiguous config", videoType: "list", listInput, storyInput: factualStoryInput,
  }));
});
