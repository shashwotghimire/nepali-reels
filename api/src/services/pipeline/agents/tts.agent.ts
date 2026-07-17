import { gClient } from "../../../configs/llm.config";
import { saveWaveFile } from "../../../helpers/tts.helper";
import { VideoSpec } from "../../../schema/video-spec.schema";

export const generateTextToSpeechAgent = async (
  videoSpec: VideoSpec,
  pipelineId: string,
) => {
  const response = await gClient.interactions.create({
    model: "gemini-3.1-flash-tts-preview",
    input: `${videoSpec.voiceoverText} and ensure the length of the audio is ${videoSpec.scenes}`,
    response_format: { type: "audio" },
    generation_config: {
      speech_config: [{ voice: "Aoede" }],
    },
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
