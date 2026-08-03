import fs from "fs";
import {
  createPipeline,
  findPipelineById,
  markPipelineAsFailed,
  resetPipelineForRetry,
  saveAudioSpec,
  saveDraftScript,
  saveFinalScript,
  saveLinguisticReview,
  saveVideoOutput,
  saveVideoSpec,
} from "../../repositories/reels.repository";
import { PipelineStatus } from "../../types/pipeline.types";
import { ApiError } from "../../utils/ApiError.util";
import { factCheckerAgent } from "../pipeline/agents/fact-checker.agent";
import { linguisticExpertAgent } from "../pipeline/agents/linguistic-expert.agent";
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
import {
  generateThumbnailAgent,
  generateThumbnailOpenRouter,
} from "./agents/thumbnail.agent";
import { saveThumbnailUrl } from "../../repositories/reels.repository";
import { validateVideoSpec } from "../../helpers/video-spec-validation.helper";
import { generateAiVideoClips } from "./agents/ai-video-generator.agent";
import { type VideoModel } from "../../constants/constant";
import { emailQueue } from "../../queue/email.queue";
import { getUser } from "../../repositories/user.repository";
import { reelReadyEmailTemplate } from "../../utils/email-templates.util";
import { uploadToTiktokService } from "../tiktok.service";

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
  autoPublish = false,
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

  console.log(`[pipeline:${pipelineId}] running linguistic review...`);
  const linguisticReview = await linguisticExpertAgent(finalScript, model);
  console.log(
    `[pipeline:${pipelineId}] linguistic review verdict: ${linguisticReview?.verdict}`,
  );
  if (linguisticReview?.verdict === "revise") {
    finalScript = linguisticReview.revisedScript!;
  }
  await saveLinguisticReview(pipelineId, userId, finalScript);
  console.log(`[pipeline:${pipelineId}] linguistic review saved`);

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
    thumbnailBuffer = await generateThumbnailOpenRouter(
      videoSpec,
      model,
      "black-forest-labs/flux.2-pro",
    );
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

  if (autoPublish) {
    try {
      console.log(`[pipeline:${pipelineId}] auto-publishing to TikTok...`);
      const hashtags = finalScript.hashtags.map((h: string) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
      const title = `${finalScript.titleOptions[0]!} ${hashtags}`.trim();
      const tiktokPublishId = await uploadToTiktokService(
        userId,
        pipelineId,
        title,
        "PUBLIC_TO_EVERYONE",
        false,
        false,
        false,
        false,
        false,
        true,
      );
      console.log(
        `[pipeline:${pipelineId}] TikTok auto-publish initiated — publishId: ${tiktokPublishId}`,
      );
    } catch (err: unknown) {
      console.warn(
        `[pipeline:${pipelineId}] TikTok auto-publish skipped: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  return await findPipelineById(pipelineId, userId);
};

export const markPipelineAsFailedService = async (
  pipelineId: string,
  failureReason?: string,
) => {
  await markPipelineAsFailed(pipelineId, failureReason);
};

const STAGE_ORDER: PipelineStatus[] = [
  "queued",
  "script_generated",
  "script_finalised",
  "linguistic_reviewed",
  "video_spec_generated",
  "sound_generated",
  "video_generated",
];

function determineResumeStage(pipeline: {
  soundSpec: any;
  videoSpec: any;
  finalScript: any;
  draftScript: any;
}): PipelineStatus {
  if (pipeline.soundSpec) return "sound_generated";
  if (pipeline.videoSpec) return "video_spec_generated";
  if (pipeline.finalScript) return "script_finalised";
  if (pipeline.draftScript) return "script_generated";
  return "queued";
}

export const retryPipelineService = async (
  userId: string,
  pipelineId: string,
) => {
  const pipeline = await findPipelineById(pipelineId, userId);
  if (!pipeline) throw new ApiError(404, "Pipeline not found", "Not found");
  if (pipeline.pipelineStatus !== "failed") {
    throw new ApiError(400, "Pipeline is not in failed state", "Cannot retry");
  }

  const resumeFrom = determineResumeStage(pipeline);
  await resetPipelineForRetry(pipelineId, userId, resumeFrom);

  return { resumeFrom, pipelineId };
};

export const resumePipelineService = async (
  userId: string,
  pipelineId: string,
  resumeFrom: PipelineStatus,
) => {
  const pipeline = await findPipelineById(pipelineId, userId);
  if (!pipeline) throw new ApiError(404, "Pipeline not found", "Not found");

  const topic = pipeline.topic;
  const model = pipeline.claudeModel;
  const videoModel = pipeline.videoModel as VideoModel;
  const resumeIndex = STAGE_ORDER.indexOf(resumeFrom);

  console.log(
    `[pipeline:${pipelineId}] resuming from stage: "${resumeFrom}" (index ${resumeIndex})`,
  );

  let draftScript = pipeline.draftScript as any;
  let finalScript = pipeline.finalScript as any;
  let videoSpec = pipeline.videoSpec as any;
  let soundSpec = pipeline.soundSpec as any;

  if (resumeIndex < 1) {
    console.log(`[pipeline:${pipelineId}] generating draft script...`);
    draftScript = await scriptGeneratorAgent(topic, model);
    await saveDraftScript(pipelineId, userId, draftScript);
    console.log(`[pipeline:${pipelineId}] draft script saved`);
  }

  if (resumeIndex < 2) {
    console.log(`[pipeline:${pipelineId}] running fact check...`);
    const factCheck = await factCheckerAgent(draftScript, model);
    if (factCheck?.verdict === "pass") {
      finalScript = draftScript;
    } else if (factCheck?.verdict === "revise") {
      finalScript = factCheck.revisedScript!;
    } else if (factCheck?.verdict === "unsafe") {
      throw new ApiError(400, `Script is unsafe: ${JSON.stringify(factCheck.issues, null, 2)}`, "Script is not safe.");
    } else {
      throw new ApiError(500, "Unexpected fact-check verdict", "Internal error");
    }
    await saveFinalScript(pipelineId, userId, finalScript);
    console.log(`[pipeline:${pipelineId}] final script saved`);
  }

  if (resumeIndex < 3) {
    console.log(`[pipeline:${pipelineId}] running linguistic review...`);
    const linguisticReview = await linguisticExpertAgent(finalScript, model);
    if (linguisticReview?.verdict === "revise") {
      finalScript = linguisticReview.revisedScript!;
    }
    await saveLinguisticReview(pipelineId, userId, finalScript);
    console.log(`[pipeline:${pipelineId}] linguistic review saved`);
  }

  if (resumeIndex < 4) {
    console.log(`[pipeline:${pipelineId}] generating video spec...`);
    videoSpec = await videoSpecGeneratorAgent(finalScript, model);
    await saveVideoSpec(pipelineId, userId, videoSpec);
    console.log(`[pipeline:${pipelineId}] video spec saved`);
  }

  if (resumeIndex < 5) {
    console.log(`[pipeline:${pipelineId}] generating audio...`);
    soundSpec = await generateTextToSpeechAgent(videoSpec, pipelineId);
    await saveAudioSpec(pipelineId, userId, soundSpec);
    console.log(`[pipeline:${pipelineId}] audio saved`);
  }

  if (resumeIndex < 6) {
    if (!fs.existsSync(soundSpec.audioFilePath)) {
      console.log(`[pipeline:${pipelineId}] audio file missing, regenerating...`);
      soundSpec = await generateTextToSpeechAgent(videoSpec, pipelineId);
      await saveAudioSpec(pipelineId, userId, soundSpec);
    }

    console.log(`[pipeline:${pipelineId}] running forced alignment...`);
    const alignedCaptions = await forcedAlignmentAgent(
      soundSpec.audioFilePath,
      videoSpec.voiceoverText,
    );

    console.log(`[pipeline:${pipelineId}] validating video spec...`);
    validateVideoSpec(videoSpec);

    console.log(`[pipeline:${pipelineId}] generating AI video clips...`);
    const bgVideoPath = await generateAiVideoClips(
      videoSpec.scenes,
      pipelineId,
      videoModel,
    );

    console.log(`[pipeline:${pipelineId}] generating thumbnail...`);
    let thumbnailBuffer: Buffer | undefined;
    try {
      thumbnailBuffer = await generateThumbnailOpenRouter(
        videoSpec,
        model,
        "black-forest-labs/flux.2-pro",
      );
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

    const videoDurationSec = await getVideoDuration(finalVideoPath);
    console.log(`[pipeline:${pipelineId}] uploading to s3`);
    const { key } = await uploadToS3(finalVideoPath, pipelineId);
    await saveVideoOutput(pipelineId, userId, key, videoDurationSec);

    const user = await getUser(userId);
    if (user) {
      const { subject, html } = reelReadyEmailTemplate(user.name, topic);
      await emailQueue.add("reel-ready", { to: user.email, subject, html });
    }

    fs.unlink(finalVideoPath, () => {});
    fs.rm(`src/video/${pipelineId}`, { recursive: true, force: true }, () => {});

    if (thumbnailBuffer) {
      try {
        const { url: tUrl } = await uploadThumbnailToS3(thumbnailBuffer, pipelineId);
        await saveThumbnailUrl(pipelineId, userId, tUrl);
      } catch (err) {
        console.warn(
          `[pipeline:${pipelineId}] thumbnail S3 upload skipped: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  return await findPipelineById(pipelineId, userId);
};
