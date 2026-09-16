import type { Caption } from "../types/subtitle.types";

export interface OverlayScene {
  startSec: number;
  endSec: number;
  onScreenText?: string;
}

/** Convert schema-validated scene emphasis into composition-ready timed overlays. */
export function buildCompositionOverlays(scenes: OverlayScene[]): Caption[] {
  return scenes.flatMap((scene) => scene.onScreenText?.trim()
    ? [{
        startSec: scene.startSec,
        endSec: scene.endSec,
        text: scene.onScreenText.trim(),
      }]
    : []);
}
