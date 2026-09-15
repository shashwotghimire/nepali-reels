import fs from "fs";
import { elevenLabsClient } from "../../../configs/elevenlabs.config";
import { buildCaptionsFromAlignment } from "../../../helpers/srt.helper";
import type { Caption } from "../../../types/subtitle.types";
import { randomUUID } from "crypto";
import { beginProviderAttempt, finishProviderAttempt } from "../../../repositories/provider-usage.repository";
import { calculateAlignmentCost } from "../../../utils/cost.util";
import { providerCallBudget } from "../budget-policy.service";
import type { MeteringContext } from "../llm-metering";

export const forcedAlignmentAgent = async (
  audioFilePath: string,
  voiceoverText: string,
  context?: MeteringContext,
): Promise<Caption[]> => {
  const attemptId = randomUUID();
  const reservation = context?.budget
    ? await context.budget.reserve(attemptId, 1, providerCallBudget())
    : undefined;
  if (context) {
    try {
      await beginProviderAttempt({ attemptId, userId: context.userId,
        pipelineId: context.pipelineId, operation: "forced_alignment", stage: context.stage,
        provider: "elevenlabs", model: "forced-alignment", configuration: {} });
    } catch (error) {
      if (reservation) await context.budget!.releaseBeforeStart(reservation);
      throw error;
    }
  }
  try {
    const result = await elevenLabsClient.forcedAlignment.create({
      file: fs.createReadStream(audioFilePath), text: voiceoverText,
    });
    const captions = buildCaptionsFromAlignment(result.words ?? []);
    const seconds = captions.length ? captions[captions.length - 1]!.endSec : null;
    const cost = seconds === null ? null : calculateAlignmentCost(seconds / 60);
    if (context) await finishProviderAttempt({ attemptId, status: "succeeded",
      usage: { audioInputSeconds: seconds }, costUsd: cost === null ? null : cost.toString(),
      costProvenance: cost === null ? "unknown" : "estimated",
      rateVersion: cost === null ? null : "planning-2026-09-14" });
    if (reservation) await context!.budget!.finalize(reservation, { providerCalls: 1 });
    return captions;
  } catch (error) {
    if (context) await finishProviderAttempt({ attemptId, status: "failed", costUsd: null,
      costProvenance: "unknown", error: String(error) });
    if (reservation) await context!.budget!.finalize(reservation, { providerCalls: 1 });
    throw error;
  }
};
