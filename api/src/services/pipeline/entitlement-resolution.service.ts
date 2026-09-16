import {
  PLAN_ENTITLEMENTS,
  type PlanEntitlement,
} from "../../commercial/policy";

export type TrustedGenerationAccess =
  | {
      kind: "verified_trial";
      grantId: string;
      userId: string;
      status: "active";
      identityVerified: true;
    }
  | {
      kind: "subscription";
      grantId: string;
      userId: string;
      status: "active";
      planId: "creator" | "plus";
      periodEndsAt: Date;
    };

/** Implement this in a repository backed by authoritative verification/billing data. */
export interface GenerationAccessRepository {
  findTrustedAccess(userId: string, at: Date): Promise<TrustedGenerationAccess | null>;
}

export interface ResolvedGenerationEntitlement {
  accessId: string;
  accessKind: TrustedGenerationAccess["kind"] | "legacy_compatibility";
  userId: string;
  entitlement: Pick<PlanEntitlement,
    "id" | "maxOutputDurationSeconds" | "aiRevisionsPerVideo" | "thumbnailsPerVideo" |
    "thumbnailRegenerationsPerVideo" | "styleSlots" | "videoTypes" | "manualScriptEditing" |
    "allSupportedVoices" | "captionPresets" | "channelOverlay"
  > | {
    id: "legacy_standard";
    maxOutputDurationSeconds: 75;
    aiRevisionsPerVideo: 0;
    thumbnailsPerVideo: 1;
    thumbnailRegenerationsPerVideo: 0;
    styleSlots: 0;
    videoTypes: readonly ["explainer", "story", "list"];
    manualScriptEditing: true;
    allSupportedVoices: true;
    captionPresets: false;
    channelOverlay: false;
  };
}

/**
 * Explicit server-side compatibility policy for the pre-billing endpoint.
 * It preserves existing Explainer access without assigning a commercial plan.
 */
export function resolveLegacyCompatibilityAccess(
  userId: string,
): ResolvedGenerationEntitlement {
  return {
    accessId: `legacy-compatibility:${userId}`,
    accessKind: "legacy_compatibility",
    userId,
    entitlement: {
      id: "legacy_standard",
      maxOutputDurationSeconds: 75,
      aiRevisionsPerVideo: 0,
      thumbnailsPerVideo: 1,
      thumbnailRegenerationsPerVideo: 0,
      styleSlots: 0,
      videoTypes: ["explainer", "story", "list"],
      manualScriptEditing: true,
      allSupportedVoices: true,
      captionPresets: false,
      channelOverlay: false,
    },
  };
}

export interface TrustedAccessResolver {
  resolve(userId: string): Promise<ResolvedGenerationEntitlement | null>;
}

/** Explicit non-production injection boundary used until billing owns access grants. */
export class EnvironmentTestAccessResolver implements TrustedAccessResolver {
  async resolve(userId: string): Promise<ResolvedGenerationEntitlement | null> {
    if (process.env.NODE_ENV === "production") return null;
    const raw = process.env.PHASE4_TEST_ENTITLEMENTS;
    if (!raw) return null;
    const grants = JSON.parse(raw) as Record<string, "trial" | "creator" | "plus">;
    const planId = grants[userId];
    if (!planId || !PLAN_ENTITLEMENTS[planId]) return null;
    return {
      accessId: `test:${userId}:${planId}`,
      accessKind: planId === "trial" ? "verified_trial" : "subscription",
      userId,
      entitlement: PLAN_ENTITLEMENTS[planId],
    };
  }
}

export async function resolveServerGenerationAccess(
  userId: string,
  resolver: TrustedAccessResolver = new EnvironmentTestAccessResolver(),
) {
  return (await resolver.resolve(userId)) ?? resolveLegacyCompatibilityAccess(userId);
}

export class GenerationAccessUnavailableError extends Error {
  constructor() {
    super("No trusted generation access is configured for this user");
    this.name = "GenerationAccessUnavailableError";
  }
}

/**
 * Resolves access only from a server-side repository. Existing users receive no
 * implicit trial, and there is no client-supplied plan input to trust by mistake.
 */
export async function resolveGenerationEntitlement(
  repository: GenerationAccessRepository,
  userId: string,
  at = new Date(),
): Promise<ResolvedGenerationEntitlement> {
  const access = await repository.findTrustedAccess(userId, at);
  if (!access || access.userId !== userId || access.status !== "active") {
    throw new GenerationAccessUnavailableError();
  }

  if (access.kind === "verified_trial" && access.identityVerified !== true) {
    throw new GenerationAccessUnavailableError();
  }
  if (
    access.kind === "subscription" &&
    (!Number.isFinite(access.periodEndsAt.getTime()) || access.periodEndsAt <= at)
  ) {
    throw new GenerationAccessUnavailableError();
  }

  const planId = access.kind === "verified_trial" ? "trial" : access.planId;
  return {
    accessId: access.grantId,
    accessKind: access.kind,
    userId,
    entitlement: PLAN_ENTITLEMENTS[planId],
  };
}

export function assertDeliveredDurationAllowed(
  access: ResolvedGenerationEntitlement,
  deliveredDurationSeconds: number,
): void {
  if (!Number.isFinite(deliveredDurationSeconds) || deliveredDurationSeconds < 0) {
    throw new Error("Delivered duration must be a non-negative finite number");
  }
  if (deliveredDurationSeconds > access.entitlement.maxOutputDurationSeconds) {
    throw new Error(
      `Delivered duration exceeds the ${access.entitlement.maxOutputDurationSeconds}-second ${access.entitlement.id} limit`,
    );
  }
}
