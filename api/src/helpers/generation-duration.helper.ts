import type { ScriptOutput } from "../schema/script-writer.schema";

export const THUMBNAIL_PREFIX_DURATION_SECONDS = 1;
export const MINIMUM_EXPLAINER_CONTENT_SECONDS = 12;

export interface DurationEntitlement {
  maxOutputDurationSeconds: number;
  thumbnailsPerVideo: number;
}

export interface ExplainerDurationPolicy {
  maxDeliveredDurationSeconds: number;
  maxContentDurationSeconds: number;
  targetContentDurationSeconds: number;
  thumbnailDurationSeconds: 0 | 1;
  includeThumbnail: boolean;
}

/** Derives generation limits exclusively from a trusted server-side entitlement. */
export function getExplainerDurationPolicy(
  entitlement: DurationEntitlement,
): ExplainerDurationPolicy {
  const includeThumbnail = entitlement.thumbnailsPerVideo > 0;
  const thumbnailDurationSeconds = includeThumbnail
    ? THUMBNAIL_PREFIX_DURATION_SECONDS
    : 0;
  const maxContentDurationSeconds =
    entitlement.maxOutputDurationSeconds - thumbnailDurationSeconds;
  if (maxContentDurationSeconds < MINIMUM_EXPLAINER_CONTENT_SECONDS) {
    throw new Error("Entitlement duration is too short for an explainer workflow");
  }
  return {
    maxDeliveredDurationSeconds: entitlement.maxOutputDurationSeconds,
    maxContentDurationSeconds,
    targetContentDurationSeconds: maxContentDurationSeconds,
    thumbnailDurationSeconds,
    includeThumbnail,
  };
}

export function validateScriptDuration(
  script: Pick<ScriptOutput, "estDurationSec" | "shotPlan">,
  maximumSeconds: number,
): void {
  if (
    !Number.isFinite(script.estDurationSec) ||
    script.estDurationSec < MINIMUM_EXPLAINER_CONTENT_SECONDS ||
    script.estDurationSec > maximumSeconds
  ) {
    throw new Error(
      `Script duration ${script.estDurationSec}s must be between ${MINIMUM_EXPLAINER_CONTENT_SECONDS}s and ${maximumSeconds}s`,
    );
  }
  const shotDuration = script.shotPlan.reduce(
    (total, shot) => total + shot.durationSec,
    0,
  );
  if (Math.abs(shotDuration - script.estDurationSec) > 0.05) {
    throw new Error(
      `Script shot plan totals ${shotDuration}s but estDurationSec is ${script.estDurationSec}s`,
    );
  }
}
