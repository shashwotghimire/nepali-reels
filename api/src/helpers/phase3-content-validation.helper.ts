import type {
  StoryInput,
  StoryScriptOutput,
  StoryVideoSpec,
} from "../schema/story.schema";
import type {
  ListInput,
  ListScriptOutput,
  ListVideoSpec,
} from "../schema/list.schema";

export const PHASE3_MIN_CLIP_SECONDS = 4;
export const PHASE3_MAX_CLIP_SECONDS = 12;
export const PHASE3_MAX_PHYSICAL_DURATION_SECONDS = 75;
const TIMING_TOLERANCE_SECONDS = 0.05;

function assertMaximum(maximumSeconds: number): void {
  if (!Number.isFinite(maximumSeconds) || maximumSeconds <= 0 || maximumSeconds > PHASE3_MAX_PHYSICAL_DURATION_SECONDS) {
    throw new Error(`Maximum content duration must be between 0 and ${PHASE3_MAX_PHYSICAL_DURATION_SECONDS} seconds`);
  }
}

function assertClipDuration(duration: number, label: string): void {
  if (!Number.isFinite(duration) || duration < PHASE3_MIN_CLIP_SECONDS || duration > PHASE3_MAX_CLIP_SECONDS) {
    throw new Error(`${label} duration ${duration}s must be between ${PHASE3_MIN_CLIP_SECONDS}s and ${PHASE3_MAX_CLIP_SECONDS}s`);
  }
}

function assertSequentialIndices(indices: number[], label: string): void {
  indices.forEach((value, index) => {
    if (value !== index + 1) throw new Error(`${label} indices must be contiguous and one-based`);
  });
}

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} must be unique`);
}

function assertCaptions(
  captions: { startSec: number; endSec: number }[],
  totalDuration: number,
): void {
  let previousEnd = 0;
  captions.forEach((caption, index) => {
    if (caption.endSec <= caption.startSec) throw new Error(`Caption ${index} must end after it starts`);
    if (caption.startSec + TIMING_TOLERANCE_SECONDS < previousEnd) throw new Error(`Caption ${index} overlaps the previous caption`);
    if (caption.endSec > totalDuration + TIMING_TOLERANCE_SECONDS) throw new Error(`Caption ${index} exceeds the content runtime`);
    previousEnd = caption.endSec;
  });
}

function assertTiledScenes(
  scenes: { startSec: number; endSec: number }[],
  maximumSeconds: number,
): number {
  if (scenes.length === 0) throw new Error("Video scenes cannot be empty");
  if (Math.abs(scenes[0]!.startSec) > TIMING_TOLERANCE_SECONDS) throw new Error("The first scene must start at 0");
  scenes.forEach((scene, index) => {
    const duration = scene.endSec - scene.startSec;
    assertClipDuration(duration, `Scene ${index + 1}`);
    if (index > 0 && Math.abs(scene.startSec - scenes[index - 1]!.endSec) > TIMING_TOLERANCE_SECONDS) {
      throw new Error(`Scene ${index + 1} must be contiguous with the previous scene`);
    }
  });
  const total = scenes.at(-1)!.endSec;
  if (total > maximumSeconds + TIMING_TOLERANCE_SECONDS) throw new Error(`Scene runtime ${total}s exceeds ${maximumSeconds}s`);
  return total;
}

export function validateStoryScript(
  input: StoryInput,
  script: StoryScriptOutput,
  maximumSeconds = PHASE3_MAX_PHYSICAL_DURATION_SECONDS,
): void {
  assertMaximum(maximumSeconds);
  if (script.treatment !== input.treatment) throw new Error("Story treatment changed during generation");
  if (!script.hookOptions.some((hook) => hook.text === script.selectedHook)) throw new Error("selectedHook must equal a supplied hook option");
  if (!script.narrationNp.trim().startsWith(script.selectedHook.trim())) throw new Error("Story narration must begin with selectedHook");
  if (script.treatment === "fictional") {
    if (script.factualClaims.length > 0) throw new Error("Fictional stories cannot emit factualClaims");
    if (!/(कल्पित|काल्पनिक|fiction)/iu.test(script.disclosureNp)) throw new Error("Fictional stories require an explicit fictional disclosure");
  } else if (script.factualClaims.length === 0) {
    throw new Error("Factual stories require claim source bases");
  }

  const characterIds = script.characters.map((character) => character.id);
  const locationIds = script.locations.map((location) => location.id);
  assertUnique(characterIds, "Story character IDs");
  assertUnique(locationIds, "Story location IDs");
  assertSequentialIndices(script.shotPlan.map((shot) => shot.index), "Story shot");
  if (script.shotPlan[0]?.beat !== "hook" || script.shotPlan.at(-1)?.beat !== "resolution" || !script.shotPlan.some((shot) => shot.beat === "climax")) {
    throw new Error("Story composition must run from hook through climax to resolution");
  }

  let shotTotal = 0;
  script.shotPlan.forEach((shot) => {
    assertClipDuration(shot.durationSec, `Story shot ${shot.index}`);
    shotTotal += shot.durationSec;
    if (!locationIds.includes(shot.locationId)) throw new Error(`Story shot ${shot.index} references unknown location ${shot.locationId}`);
    shot.characterIds.forEach((id) => {
      if (!characterIds.includes(id)) throw new Error(`Story shot ${shot.index} references unknown character ${id}`);
    });
  });
  if (Math.abs(shotTotal - script.estDurationSec) > TIMING_TOLERANCE_SECONDS) throw new Error("Story shot durations must sum to estDurationSec");
  if (script.estDurationSec > maximumSeconds) throw new Error(`Story duration ${script.estDurationSec}s exceeds ${maximumSeconds}s`);
  assertCaptions(script.captions, script.estDurationSec);
}

export function validateStoryVideoSpec(
  input: StoryInput,
  spec: StoryVideoSpec,
  maximumSeconds = PHASE3_MAX_PHYSICAL_DURATION_SECONDS,
): void {
  assertMaximum(maximumSeconds);
  if (spec.treatment !== input.treatment) throw new Error("Story video treatment changed during composition");
  assertTiledScenes(spec.scenes, maximumSeconds);
  const characterIds = spec.characterBible.map((entry) => entry.id);
  const locationIds = spec.locationBible.map((entry) => entry.id);
  assertUnique(characterIds, "Story character bible IDs");
  assertUnique(locationIds, "Story location bible IDs");
  spec.scenes.forEach((scene, index) => {
    if (!locationIds.includes(scene.locationId)) throw new Error(`Story scene ${index + 1} references unknown location ${scene.locationId}`);
    scene.characterIds.forEach((id) => {
      if (!characterIds.includes(id)) throw new Error(`Story scene ${index + 1} references unknown character ${id}`);
    });
  });
  if (spec.scenes[0]?.beat !== "hook" || spec.scenes.at(-1)?.beat !== "resolution" || !spec.scenes.some((scene) => scene.beat === "climax")) {
    throw new Error("Story scenes must preserve the hook, climax, and resolution composition");
  }
}

function expectedListNumbers(input: ListInput): number[] {
  return Array.from({ length: input.itemCount }, (_, index) =>
    input.order === "ascending" ? index + 1 : input.itemCount - index,
  );
}

export function validateListScript(
  input: ListInput,
  script: ListScriptOutput,
  maximumSeconds = PHASE3_MAX_PHYSICAL_DURATION_SECONDS,
): void {
  assertMaximum(maximumSeconds);
  if (script.order !== input.order || script.itemCount !== input.itemCount) throw new Error("List order or item count changed during generation");
  if (script.items.length !== input.itemCount) throw new Error(`List must contain exactly ${input.itemCount} items`);
  const actualNumbers = script.items.map((item) => item.number);
  const expectedNumbers = expectedListNumbers(input);
  if (actualNumbers.some((number, index) => number !== expectedNumbers[index])) throw new Error(`List numbering must be ${expectedNumbers.join(", ")}`);
  assertUnique(script.items.map((item) => item.labelNp.trim().toLocaleLowerCase()), "List item labels");

  assertClipDuration(script.hook.durationSec, "List hook");
  assertClipDuration(script.closing.durationSec, "List closing");
  let total = script.hook.durationSec + script.closing.durationSec;
  script.items.forEach((item) => {
    assertClipDuration(item.durationSec, `List item ${item.number}`);
    total += item.durationSec;
  });
  if (Math.abs(total - script.estDurationSec) > TIMING_TOLERANCE_SECONDS) throw new Error("List segment durations must sum to estDurationSec");
  if (script.estDurationSec > maximumSeconds) throw new Error(`List duration ${script.estDurationSec}s exceeds ${maximumSeconds}s`);
  assertCaptions(script.captions, script.estDurationSec);
}

export function validateListVideoSpec(
  input: ListInput,
  spec: ListVideoSpec,
  maximumSeconds = PHASE3_MAX_PHYSICAL_DURATION_SECONDS,
): void {
  assertMaximum(maximumSeconds);
  if (spec.order !== input.order) throw new Error("List video order changed during composition");
  assertTiledScenes(spec.scenes, maximumSeconds);
  if (spec.scenes.length !== input.itemCount + 2) throw new Error("List video must contain one hook, one scene per item, and one closing scene");
  if (spec.scenes[0]?.role !== "hook" || spec.scenes[0]?.itemNumber !== null) throw new Error("List video must begin with an unnumbered hook scene");
  if (spec.scenes.at(-1)?.role !== "closing" || spec.scenes.at(-1)?.itemNumber !== null) throw new Error("List video must end with an unnumbered closing scene");
  const itemScenes = spec.scenes.slice(1, -1);
  const expectedNumbers = expectedListNumbers(input);
  itemScenes.forEach((scene, index) => {
    if (scene.role !== "item" || scene.itemNumber !== expectedNumbers[index]) throw new Error(`List scene ${index + 2} must represent item ${expectedNumbers[index]}`);
    if (!scene.onScreenText?.includes(String(expectedNumbers[index]))) {
      throw new Error(`List scene ${index + 2} must display item number ${expectedNumbers[index]}`);
    }
  });
}
