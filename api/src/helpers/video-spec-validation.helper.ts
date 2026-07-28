import { VideoSpec } from "../schema/video-spec.schema";
import {
  AI_VIDEO_MIN_SCENE_DURATION,
  AI_VIDEO_MAX_SCENE_DURATION,
  AI_VIDEO_MIN_TOTAL_DURATION,
  AI_VIDEO_MAX_TOTAL_DURATION,
  AI_VIDEO_SCENE_CONTIGUITY_TOLERANCE,
} from "../constants/constant";

export function validateVideoSpec(spec: VideoSpec): void {
  const { scenes } = spec;

  if (scenes.length === 0) {
    throw new Error("VideoSpec validation failed: scenes array is empty");
  }

  if (Math.abs(scenes[0]!.startSec) > AI_VIDEO_SCENE_CONTIGUITY_TOLERANCE) {
    throw new Error(
      `VideoSpec validation failed: scene 0 must start at 0 (got ${scenes[0]!.startSec})`,
    );
  }

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]!;
    const duration = scene.endSec - scene.startSec;

    if (scene.endSec <= scene.startSec) {
      throw new Error(
        `VideoSpec validation failed: scene ${i} has endSec (${scene.endSec}) <= startSec (${scene.startSec})`,
      );
    }

    if (duration < AI_VIDEO_MIN_SCENE_DURATION) {
      throw new Error(
        `VideoSpec validation failed: scene ${i} duration ${duration.toFixed(2)}s is below minimum ${AI_VIDEO_MIN_SCENE_DURATION}s`,
      );
    }

    if (duration > AI_VIDEO_MAX_SCENE_DURATION) {
      throw new Error(
        `VideoSpec validation failed: scene ${i} duration ${duration.toFixed(2)}s exceeds maximum ${AI_VIDEO_MAX_SCENE_DURATION}s`,
      );
    }

    if (i > 0) {
      const prev = scenes[i - 1]!;
      const gap = Math.abs(scene.startSec - prev.endSec);
      if (gap > AI_VIDEO_SCENE_CONTIGUITY_TOLERANCE) {
        throw new Error(
          `VideoSpec validation failed: gap between scene ${i - 1} (endSec=${prev.endSec}) and scene ${i} (startSec=${scene.startSec}) is ${gap.toFixed(3)}s — scenes must be contiguous`,
        );
      }
    }
  }

  const totalDuration = scenes[scenes.length - 1]!.endSec;

  if (totalDuration < AI_VIDEO_MIN_TOTAL_DURATION || totalDuration > AI_VIDEO_MAX_TOTAL_DURATION) {
    throw new Error(
      `VideoSpec validation failed: total duration ${totalDuration.toFixed(2)}s must be between ${AI_VIDEO_MIN_TOTAL_DURATION}s and ${AI_VIDEO_MAX_TOTAL_DURATION}s`,
    );
  }
}
