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
import { forcedAlignmentAgent } from "./agents/forced-alignment.agent";
import {
  compositeVideo,
  burnThumbnailIntoVideo,
  validateFinalVideo,
  getVideoDuration,
} from "../../helpers/video.helper";
import { uploadToS3, uploadThumbnailToS3 } from "../s3.service";
import { generateThumbnailAgent, generateThumbnailOpenRouter } from "./agents/thumbnail.agent";
import { saveThumbnailUrl } from "../../repositories/reels.repository";
import { validateVideoSpec } from "../../helpers/video-spec-validation.helper";
import { generateAiVideoClips } from "./agents/ai-video-generator.agent";
import { type VideoModel } from "../../constants/constant";
import { emailQueue } from "../../queue/email.queue";
import { getUser } from "../../repositories/user.repository";
import { reelReadyEmailTemplate } from "../../utils/email-templates.util";

export const initPipelineService = async (
  userId: string,
  topic: string,
  model: string,
  videoModel: VideoModel,
) => {
  return await createPipeline(userId, topic, model, videoModel);
};

export const createPipelineService = async (
  userId: string,
  pipelineId: string,
  topic: string,
  model: string,
  videoModel: VideoModel,
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

  console.log(`[pipeline:${pipelineId}] running forced alignment...`);
  const alignedCaptions = await forcedAlignmentAgent(
    soundSpec.audioFilePath,
    videoSpec.voiceoverText,
  );
  console.log(
    `[pipeline:${pipelineId}] forced alignment done — ${alignedCaptions.length} caption chunks`,
  );

  console.log(`[pipeline:${pipelineId}] validating video spec...`);
  validateVideoSpec(videoSpec);
  console.log(`[pipeline:${pipelineId}] video spec valid`);

  console.log(`[pipeline:${pipelineId}] generating AI video clips...`);
  const bgVideoPath = await generateAiVideoClips(
    videoSpec.scenes,
    pipelineId,
    videoModel,
  );
  console.log(
    `[pipeline:${pipelineId}] AI background assembled at ${bgVideoPath}`,
  );

  console.log(`[pipeline:${pipelineId}] generating thumbnail...`);
  let thumbnailBuffer: Buffer | undefined;
  try {
    thumbnailBuffer = await generateThumbnailOpenRouter(videoSpec, model, "black-forest-labs/flux.2-pro");
    // thumbnailBuffer = await generateThumbnailAgent(videoSpec, model);
  } catch (err) {
    console.warn(
      `[pipeline:${pipelineId}] thumbnail generation skipped: ${err instanceof Error ? err.message : err}`,
    );
  }

  console.log(`[pipeline:${pipelineId}] compositing video...`);
  const rawVideoPath = await compositeVideo(
    pipelineId,
    alignedCaptions,
    bgVideoPath,
  );

  let finalVideoPath = rawVideoPath;
  if (thumbnailBuffer) {
    console.log(`[pipeline:${pipelineId}] burning thumbnail into video...`);
    try {
      finalVideoPath = await burnThumbnailIntoVideo(
        rawVideoPath,
        thumbnailBuffer,
        pipelineId,
      );
      fs.unlink(rawVideoPath, () => {});
    } catch (err) {
      console.warn(
        `[pipeline:${pipelineId}] thumbnail burn skipped: ${err instanceof Error ? err.message : err}`,
      );
      finalVideoPath = rawVideoPath;
    }
  }

  // console.log(`[pipeline:${pipelineId}] validating final video...`);
  // await validateFinalVideo(finalVideoPath);
  const videoDurationSec = await getVideoDuration(finalVideoPath);
  console.log(`[pipeline:${pipelineId}] uploading to s3`);
  const { key, url } = await uploadToS3(finalVideoPath, pipelineId);
  console.log("Uploaded to S3");
  await saveVideoOutput(pipelineId, userId, key, videoDurationSec);

  const user = await getUser(userId);
  if (user) {
    const { subject, html } = reelReadyEmailTemplate(user.name, topic);
    await emailQueue.add("reel-ready", { to: user.email, subject, html });
    console.log(
      `[pipeline:${pipelineId}] reel-ready email queued for ${user.email}`,
    );
  }

  fs.unlink(finalVideoPath, (err) => {
    if (err)
      console.warn(
        `[pipeline:${pipelineId}] failed to delete local video: ${err.message}`,
      );
  });
  fs.rm(`src/video/${pipelineId}`, { recursive: true, force: true }, (err) => {
    if (err)
      console.warn(
        `[pipeline:${pipelineId}] failed to delete clip dir: ${err.message}`,
      );
  });

  let thumbnailUrl: string | undefined;
  if (thumbnailBuffer) {
    try {
      const { url: tUrl } = await uploadThumbnailToS3(
        thumbnailBuffer,
        pipelineId,
      );
      thumbnailUrl = tUrl;
      await saveThumbnailUrl(pipelineId, userId, thumbnailUrl);
      console.log(
        `[pipeline:${pipelineId}] thumbnail uploaded: ${thumbnailUrl}`,
      );
    } catch (err) {
      console.warn(
        `[pipeline:${pipelineId}] thumbnail S3 upload skipped: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // Auto-publish removed — user triggers publish manually from the pipeline detail page.
  // try {
  //   console.log(`[pipeline:${pipelineId}] publishing to TikTok...`);
  //   const tiktokPublishId = await uploadToTiktokService(
  //     userId,
  //     pipelineId,
  //     `https://${url}`,
  //     finalScript.titleOptions[0]!,
  //   );
  //   console.log(
  //     `[pipeline:${pipelineId}] TikTok publish initiated — publishId: ${tiktokPublishId}`,
  //   );
  // } catch (err: unknown) {
  //   console.warn(
  //     `[pipeline:${pipelineId}] TikTok publish skipped: ${err instanceof Error ? err.message : err}`,
  //   );
  // }

  return await findPipelineById(pipelineId, userId);
};

export const markPipelineAsFailedService = async (pipelineId: string) => {
  await markPipelineAsFailed(pipelineId);
};
