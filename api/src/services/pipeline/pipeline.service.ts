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

export const initPipelineService = async (userId: string, topic: string, model: string) => {
  return await createPipeline(userId, topic, model);
};

export const createPipelineService = async (userId: string, pipelineId: string, topic: string, model: string) => {
  console.log(`[pipeline:${pipelineId}] starting pipeline for topic: "${topic}" with model: ${model}`);

  console.log(`[pipeline:${pipelineId}] generating draft script...`);
  const draftScript = await scriptGeneratorAgent(topic, model);
  await saveDraftScript(pipelineId, userId, draftScript);
  console.log(`draft script: \n${JSON.stringify(draftScript)}`);
  console.log(`[pipeline:${pipelineId}] draft script saved`);

  console.log(`[pipeline:${pipelineId}] running fact check...`);
  const factCheck = await factCheckerAgent(draftScript, model);
  console.log(`final script: \n${JSON.stringify(factCheck)}`);
  console.log(`[pipeline:${pipelineId}] fact check verdict: ${factCheck?.verdict}`);

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
  await saveFinalScript(pipelineId, userId, finalScript);
  console.log(`[pipeline:${pipelineId}] final script saved`);

  console.log(`[pipeline:${pipelineId}] generating video spec...`);
  const videoSpec = await videoSpecGeneratorAgent(finalScript, model);
  await saveVideoSpec(pipelineId, userId, videoSpec);
  console.log(`[pipeline:${pipelineId}] video spec saved`);

  console.log(`[pipeline:${pipelineId}] generating audio...`);
  const soundSpec = await generateTextToSpeechAgent(videoSpec, pipelineId);
  await saveAudioSpec(pipelineId, userId, soundSpec);
  console.log(`[pipeline:${pipelineId}] audio saved — pipeline complete`);

  return await findPipelineById(pipelineId, userId);
};
