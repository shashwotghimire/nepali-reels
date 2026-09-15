import { gClient } from "../../../configs/llm.config";
import { saveWaveFile } from "../../../helpers/tts.helper";
import { VideoSpec } from "../../../schema/video-spec.schema";
import { randomUUID } from "crypto";
import { beginProviderAttempt, finishProviderAttempt } from "../../../repositories/provider-usage.repository";
import { estimateTtsTokenCost } from "../../../utils/cost.util";
import { extractTtsUsage } from "../../../helpers/usage.helper";
import { estimateInputTokenReservation } from "../../../helpers/phase2-budget.helper";
import { providerCallBudget } from "../budget-policy.service";
import type { MeteringContext } from "../llm-metering";


export const generateTextToSpeechAgent = async (
  videoSpec: VideoSpec,
  pipelineId: string,
  ttsVoice = "aoede",
  context?: MeteringContext,
) => {
  const model = "gemini-3.1-flash-tts-preview";
  const attemptId = randomUUID();
  const reservation = context?.budget
    ? await context.budget.reserve(attemptId, 1, providerCallBudget({
      inputTokens: estimateInputTokenReservation(videoSpec.voiceoverText),
      outputTokens: 2_400,
    }))
    : undefined;
  if (context) {
    try {
      await beginProviderAttempt({
        attemptId, userId: context.userId, pipelineId: context.pipelineId,
        operation: "tts", stage: context.stage, provider: "google", model,
        configuration: { voice: ttsVoice, responseFormat: "audio" },
      });
    } catch (error) {
      if (reservation) await context.budget!.releaseBeforeStart(reservation);
      throw error;
    }
  }
  let response;
  try {
    response = await gClient.interactions.create({
    model,
    input: `${videoSpec.voiceoverText} and ensure the length of the audio is ${videoSpec.scenes}`,
    response_format: { type: "audio" },
    generation_config: {
      speech_config: [{ voice: ttsVoice }],
    },
    });
  } catch (error) {
    if (context) await finishProviderAttempt({ attemptId, status: "failed", costUsd: null,
      costProvenance: "unknown", error: String(error) });
    if (reservation) await context!.budget!.finalize(reservation, {
      providerCalls: 1, inputTokens: null, outputTokens: null,
    });
    throw error;
  }
  const { inputTokens, cacheReadTokens, outputAudioTokens } = extractTtsUsage(response);
  const cost = estimateTtsTokenCost(inputTokens, outputAudioTokens, model);
  if (!response) {
    throw new Error("Error generating tts");
  }
  const audioData = response.output_audio?.data;
  if (!audioData) {
    if (context) await finishProviderAttempt({
      attemptId, status: "failed", costUsd: cost === null ? null : cost.toString(),
      costProvenance: cost === null ? "unknown" : "estimated",
      rateVersion: cost === null ? null : "planning-2026-09-14",
      usage: { inputTokens, outputTokens: outputAudioTokens, cacheReadTokens,
        audioCharacters: videoSpec.voiceoverText.length },
      error: "TTS missing audio data",
    });
    if (reservation) await context!.budget!.finalize(reservation, {
      providerCalls: 1, inputTokens, outputTokens: outputAudioTokens,
    });
    throw new Error("TTS missing audio data");
  }
  if (context) await finishProviderAttempt({
    attemptId, status: "succeeded", costUsd: cost === null ? null : cost.toString(),
    costProvenance: cost === null ? "unknown" : "estimated", rateVersion: cost === null ? null : "planning-2026-09-14",
    usage: { inputTokens, outputTokens: outputAudioTokens, cacheReadTokens,
      audioCharacters: videoSpec.voiceoverText.length },
  });
  if (reservation) await context!.budget!.finalize(reservation, {
    providerCalls: 1,
    inputTokens,
    outputTokens: outputAudioTokens,
  });
  const audioBuffer = Buffer.from(audioData, "base64");
  const filePath = `src/audio/${pipelineId}.wav`;
  await saveWaveFile(filePath, audioBuffer);
  return { audioFilePath: filePath };
};
