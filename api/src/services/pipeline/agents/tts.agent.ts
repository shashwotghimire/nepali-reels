import { gClient } from "../../../configs/llm.config";
import { saveWaveFile } from "../../../helpers/tts.helper";
import { VideoSpec } from "../../../schema/video-spec.schema";
import { randomUUID } from "crypto";
import { beginProviderAttempt, finishProviderAttempt } from "../../../repositories/provider-usage.repository";
import { estimateTtsTokenCost } from "../../../utils/cost.util";
import { extractTtsUsage } from "../../../helpers/usage.helper";

type MeteringContext = { userId: string; pipelineId: string; stage: string };

export const generateTextToSpeechAgent = async (
  videoSpec: VideoSpec,
  pipelineId: string,
  ttsVoice = "aoede",
  context?: MeteringContext,
) => {
  const model = "gemini-3.1-flash-tts-preview";
  const attemptId = randomUUID();
  if (context) await beginProviderAttempt({
    attemptId, userId: context.userId, pipelineId: context.pipelineId,
    operation: "tts", stage: context.stage, provider: "google", model,
    configuration: { voice: ttsVoice, responseFormat: "audio" },
  });
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
    throw error;
  }
  const { inputTokens, cacheReadTokens, outputAudioTokens } = extractTtsUsage(response);
  const cost = estimateTtsTokenCost(inputTokens, outputAudioTokens, model);
  if (context) await finishProviderAttempt({
    attemptId, status: "succeeded", costUsd: cost === null ? null : cost.toString(),
    costProvenance: cost === null ? "unknown" : "estimated", rateVersion: cost === null ? null : "planning-2026-09-14",
    usage: { inputTokens, outputTokens: outputAudioTokens, cacheReadTokens,
      audioCharacters: videoSpec.voiceoverText.length },
  });
  if (!response) {
    throw new Error("Error generating tts");
  }
  const audioData = response.output_audio?.data;
  if (!audioData) {
    throw new Error("TTS missing audio data");
  }
  const audioBuffer = Buffer.from(audioData, "base64");
  const filePath = `src/audio/${pipelineId}.wav`;
  await saveWaveFile(filePath, audioBuffer);
  return { audioFilePath: filePath };
};
