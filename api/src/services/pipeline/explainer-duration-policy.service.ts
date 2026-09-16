import type { ScriptOutput } from "../../schema/script-writer.schema";
import type { VideoSpec } from "../../schema/video-spec.schema";
import {
  getExplainerDurationPolicy,
  validateScriptDuration,
} from "../../helpers/generation-duration.helper";
import { validateVideoSpec } from "../../helpers/video-spec-validation.helper";
import { validateFinalVideo } from "../../helpers/video.helper";
import {
  assertDeliveredDurationAllowed,
  type ResolvedGenerationEntitlement,
} from "./entitlement-resolution.service";

export function createExplainerDurationPolicy(
  access: ResolvedGenerationEntitlement,
  containerValidator: (
    filePath: string,
    maximumDurationSeconds: number,
  ) => Promise<void> = validateFinalVideo,
) {
  const limits = getExplainerDurationPolicy(access.entitlement);
  const promptDuration = {
    targetDurationSeconds: limits.targetContentDurationSeconds,
    maximumDurationSeconds: limits.maxContentDurationSeconds,
  };
  return {
    ...limits,
    promptDuration,
    validateScript(script: ScriptOutput) {
      validateScriptDuration(script, limits.maxContentDurationSeconds);
    },
    validateVideoSpec(spec: VideoSpec) {
      validateVideoSpec(spec, limits.maxContentDurationSeconds);
    },
    async validateRenderedVideo(filePath: string, deliveredDurationSeconds: number) {
      await containerValidator(filePath, limits.maxDeliveredDurationSeconds);
      assertDeliveredDurationAllowed(access, deliveredDurationSeconds);
    },
  };
}
