import fs from "fs";
import {
  createPipeline,
  findPipelineById,
  markPipelineAsFailed,
  saveAudioSpec,
  saveDraftScript,
  saveFinalScript,
  saveVideoOutput,
  saveVideoSpec,
} from "../../repositories/reels.repository";
import { ApiError } from "../../utils/ApiError.util";
import { factCheckerAgent } from "../pipeline/agents/fact-checker.agent";
import { scriptGeneratorAgent } from "../pipeline/agents/script-writer.agent";
import { videoSpecGeneratorAgent } from "../pipeline/agents/video-spec-generator.agent";
import { generateTextToSpeechAgent } from "./agents/tts.agent";
import { compositeVideo } from "../../helpers/video.helper";
import { uploadToS3 } from "../s3.service";
import { uploadToTiktokService } from "../tiktok.service";

export const initPipelineService = async (
  userId: string,
  topic: string,
  model: string,
) => {
  return await createPipeline(userId, topic, model);
};

export const createPipelineService = async (
  userId: string,
  pipelineId: string,
  topic: string,
  model: string,
) => {
  console.log(
    `[pipeline:${pipelineId}] starting pipeline for topic: "${topic}" with model: ${model}`,
  );

  console.log(`[pipeline:${pipelineId}] generating draft script...`);
  const draftScript = await scriptGeneratorAgent(topic, model);
  await saveDraftScript(pipelineId, userId, draftScript);
  console.log(`draft script: \n${JSON.stringify(draftScript)}`);
  console.log(`[pipeline:${pipelineId}] draft script saved`);

  console.log(`[pipeline:${pipelineId}] running fact check...`);
  const factCheck = await factCheckerAgent(draftScript, model);
  console.log(`final script: \n${JSON.stringify(factCheck)}`);
  console.log(
    `[pipeline:${pipelineId}] fact check verdict: ${factCheck?.verdict}`,
  );

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
  console.log(`[pipeline:${pipelineId}] audio saved`);

  console.log(`[pipeline:${pipelineId}] compositing video...`);
  const videoFilePath = await compositeVideo(pipelineId, videoSpec.scenes);
  console.log(`[pipeline:${pipelineId}] video composited, uploading to s3`);
  const { key, url } = await uploadToS3(videoFilePath, pipelineId);
  console.log("Uploaded to S3");
  await saveVideoOutput(pipelineId, userId, key);
  fs.unlink(videoFilePath, (err) => {
    if (err) console.warn(`[pipeline:${pipelineId}] failed to delete local video: ${err.message}`);
  });

  try {
    console.log(`[pipeline:${pipelineId}] publishing to TikTok...`);
    const tiktokPublishId = await uploadToTiktokService(
      userId,
      pipelineId,
      `https://${url}`,
      finalScript.titleOptions[0]!,
    );
    console.log(
      `[pipeline:${pipelineId}] TikTok publish initiated — publishId: ${tiktokPublishId}`,
    );
  } catch (err: unknown) {
    console.warn(
      `[pipeline:${pipelineId}] TikTok publish skipped: ${err instanceof Error ? err.message : err}`,
    );
  }

  return await findPipelineById(pipelineId, userId);
};

export const markPipelineAsFailedService = async (pipelineId: string) => {
  await markPipelineAsFailed(pipelineId);
};
