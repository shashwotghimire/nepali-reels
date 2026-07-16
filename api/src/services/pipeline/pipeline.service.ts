import {
  createPipeline,
  findPipelineById,
  saveAudioSpec,
  saveDraftScript,
  saveFinalScript,
  saveVideoSpec,
} from "../../repositories/reels.repository";
import { ApiError } from "../../utils/ApiError.util";
import { factCheckerAgent } from "../pipeline/agents/fact-checker.agent";
import { scriptGeneratorAgent } from "../pipeline/agents/script-writer.agent";
import { videoSpecGeneratorAgent } from "../pipeline/agents/video-spec-generator.agent";
import { generateTextToSpeechAgent } from "./agents/tts.agent";

export const createPipelineService = async (userId: string, topic: string) => {
  const pipeline = await createPipeline(userId, topic);
  const draftScript = await scriptGeneratorAgent(topic);
  await saveDraftScript(pipeline.id, userId, draftScript);
  const factCheck = await factCheckerAgent(draftScript);

  let finalScript;
  if (factCheck?.verdict === "pass") {
    finalScript = draftScript;
  } else if (factCheck?.verdict === "revise") {
    finalScript = factCheck.revisedScript!;
  } else if (factCheck?.verdict === "needs_human") {
    throw new ApiError(
      400,
      `Issue in the script: ${JSON.stringify(factCheck.issues, null, 2)}`,
      "Needs human intervention",
    );
  } else if (factCheck?.verdict === "unsafe") {
    throw new ApiError(
      400,
      `Script is unsafe: ${JSON.stringify(factCheck.issues, null, 2)}`,
      "Script is not safe.",
    );
  } else {
    throw new ApiError(500, "Unexpected fact-check verdict", "Internal error");
  }
  await saveFinalScript(pipeline.id, userId, finalScript);
  const videoSpec = await videoSpecGeneratorAgent(finalScript);
  await saveVideoSpec(pipeline.id, userId, videoSpec);
  const soundSpec = await generateTextToSpeechAgent(videoSpec, pipeline.id);
  await saveAudioSpec(pipeline.id, userId, soundSpec);
  return await findPipelineById(pipeline.id, userId);
};
