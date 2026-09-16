import fs from "node:fs";
import path from "node:path";
import type { Caption } from "../../types/subtitle.types";
import type { ScriptOutput } from "../../schema/script-writer.schema";
import type { VideoSpec } from "../../schema/video-spec.schema";
import type { VideoModel } from "../../constants/constant";
import {
  findPipelineById,
  saveAudioSpec,
  saveDraftScript,
  saveFinalScript,
  saveLinguisticReview,
  savePipelineCost,
  saveThumbnailUrl,
  saveVideoOutput,
  saveVideoSpec,
} from "../../repositories/reels.repository";
import { getPipelineCostSummary } from "../../repositories/provider-usage.repository";
import { factCheckerAgent } from "./agents/fact-checker.agent";
import { linguisticExpertAgent } from "./agents/linguistic-expert.agent";
import { scriptGeneratorAgent } from "./agents/script-writer.agent";
import { videoSpecGeneratorAgent } from "./agents/video-spec-generator.agent";
import { generateTextToSpeechAgent } from "./agents/tts.agent";
import { forcedAlignmentAgent } from "./agents/forced-alignment.agent";
import { generateAiVideoClips } from "./agents/ai-video-generator.agent";
import { generateThumbnailOpenRouter } from "./agents/thumbnail.agent";
import {
  burnThumbnailIntoVideo,
  compositeVideo,
  getVideoDuration,
} from "../../helpers/video.helper";
import { ApiError } from "../../utils/ApiError.util";
import { uploadThumbnailToS3, uploadToS3 } from "../s3.service";
import { getUser } from "../../repositories/user.repository";
import { reelReadyEmailTemplate } from "../../utils/email-templates.util";
import { emailQueue } from "../../queue/email.queue";
import { uploadToTiktokService } from "../tiktok.service";
import {
  EXPLAINER_WORKFLOW_VERSION,
  type ExplainerStage,
  type WorkflowStage,
} from "../../helpers/workflow.helper";
import {
  stableFingerprint,
  workflowArtifactKey,
} from "../../helpers/workflow-artifact.helper";
import {
  persistWorkflowFile,
  restoreWorkflowFile,
} from "./workflow-artifact.service";
import { dispatchExplainerWorkflow, WorkflowAwaitingApprovalError } from "./workflow-dispatcher.service";
import {
  createWorkflowCheckpointPort,
  seedLegacyExplainerCheckpoints,
} from "./workflow-checkpoint.service";
import type { ResolvedGenerationEntitlement } from "./entitlement-resolution.service";
import { createProviderBudgetContext } from "./provider-budget.service";
import { reelReadyNotificationJobId } from "../../helpers/notification.helper";
import { createExplainerDurationPolicy } from "./explainer-duration-policy.service";
import type { MeteringContext } from "./llm-metering";
import type { WorkflowStageLease } from "./workflow-dispatcher.service";
import { runWithActiveStageLease } from "./workflow-lease.service";
import { attemptAutoPublish } from "./auto-publish.service";

type StageOutput = Record<string, unknown>;

function output<T extends StageOutput>(
  outputs: ReadonlyMap<WorkflowStage, object | null>,
  stage: ExplainerStage,
): T | null {
  return (outputs.get(stage) as T | null | undefined) ?? null;
}

export async function runExplainerWorkflow(input: {
  userId: string;
  pipelineId: string;
  executionKey: string;
  leaseOwner: string;
  autoPublish: boolean;
  access: ResolvedGenerationEntitlement;
}) {
  const initial = await findPipelineById(input.pipelineId, input.userId);
  if (!initial) throw new ApiError(404, "Pipeline not found", "Not found");
  if (initial.videoType !== "explainer") {
    throw new Error(`Unsupported video type ${initial.videoType}`);
  }
  if (initial.workflowVersion !== EXPLAINER_WORKFLOW_VERSION) {
    throw new Error(`Unsupported explainer workflow version ${initial.workflowVersion}`);
  }
  await seedLegacyExplainerCheckpoints({
    pipelineId: input.pipelineId,
    userId: input.userId,
    pipeline: initial,
  });

  const budget = createProviderBudgetContext(input.pipelineId, input.access);
  const durationPolicy = createExplainerDurationPolicy(input.access);
  const metering: MeteringContext = {
    userId: input.userId,
    pipelineId: input.pipelineId,
    stage: "",
    budget,
  };
  const syncCost = async (lease: WorkflowStageLease) => {
    const summary = await getPipelineCostSummary(input.pipelineId, input.userId);
    await savePipelineCost(input.pipelineId, input.userId, summary.knownCostUsd, true, lease);
  };
  const load = async () => {
    const pipeline = await findPipelineById(input.pipelineId, input.userId);
    if (!pipeline) throw new Error("Reel not found");
    return pipeline;
  };

  await dispatchExplainerWorkflow({
    pipelineId: input.pipelineId,
    userId: input.userId,
    executionKey: input.executionKey,
    checkpoints: createWorkflowCheckpointPort(input.executionKey, input.leaseOwner),
    executor: {
      async execute(stage, outputs, lease) {
        if (!lease) throw new Error(`Workflow stage ${stage} has no active lease`);
        metering.stage = stage;
        metering.lease = lease;
        const pipeline = await load();
        switch (stage) {
          case "script": {
            const result = await scriptGeneratorAgent(
              pipeline.topic,
              pipeline.claudeModel,
              metering,
              durationPolicy.promptDuration,
            );
            durationPolicy.validateScript(result.data);
            await saveDraftScript(input.pipelineId, input.userId, result.data, lease);
            await syncCost(lease);
            return { persisted: "draftScript" };
          }
          case "fact_check": {
            const draftScript = pipeline.draftScript as ScriptOutput | null;
            if (!draftScript) throw new Error("Draft script checkpoint has no script");
            const { data: factCheck } = await factCheckerAgent(draftScript, pipeline.claudeModel, metering);
            await syncCost(lease);
            let finalScript: ScriptOutput;
            if (factCheck?.verdict === "pass") finalScript = draftScript;
            else if (factCheck?.verdict === "revise") finalScript = factCheck.revisedScript!;
            else if (factCheck?.verdict === "unsafe") {
              throw new ApiError(400, `Script is unsafe: ${JSON.stringify(factCheck.issues)}`, "Script is not safe.");
            } else throw new Error("Unexpected fact-check verdict");
            durationPolicy.validateScript(finalScript);
            await saveFinalScript(input.pipelineId, input.userId, finalScript, lease);
            return { persisted: "finalScript" };
          }
          case "linguistic_review": {
            const finalScript = pipeline.finalScript as ScriptOutput | null;
            if (!finalScript) throw new Error("Final script checkpoint has no script");
            const { data: review } = await linguisticExpertAgent(finalScript, pipeline.claudeModel, metering);
            await syncCost(lease);
            const reviewedScript = review?.verdict === "revise"
              ? review.revisedScript!
              : finalScript;
            durationPolicy.validateScript(reviewedScript);
            await saveLinguisticReview(
              input.pipelineId,
              input.userId,
              reviewedScript,
              lease,
            );
            return { persisted: "finalScript" };
          }
          case "video_spec": {
            if (!pipeline.scriptApprovedAt || pipeline.approvedScriptFingerprint !== stableFingerprint(pipeline.finalScript)) throw new WorkflowAwaitingApprovalError();
            const finalScript = pipeline.finalScript as ScriptOutput | null;
            if (!finalScript) throw new Error("Final script checkpoint has no script");
            const { data: videoSpec } = await videoSpecGeneratorAgent(
              finalScript,
              pipeline.claudeModel,
              metering,
              durationPolicy.promptDuration,
            );
            durationPolicy.validateVideoSpec(videoSpec);
            await saveVideoSpec(input.pipelineId, input.userId, videoSpec, lease);
            await syncCost(lease);
            return { persisted: "videoSpec" };
          }
          case "audio": {
            const videoSpec = pipeline.videoSpec as VideoSpec | null;
            if (!videoSpec) throw new Error("Video spec checkpoint has no specification");
            const sound = await generateTextToSpeechAgent(
              videoSpec, input.pipelineId, pipeline.ttsVoice ?? "aoede", metering,
            );
            const artifactKey = workflowArtifactKey(EXPLAINER_WORKFLOW_VERSION, "audio", "narration");
            await persistWorkflowFile({
              pipelineId: input.pipelineId, userId: input.userId, artifactKey,
              kind: "audio", filePath: sound.audioFilePath, extension: "wav",
              contentType: "audio/wav", fingerprint: stableFingerprint({
                text: videoSpec.voiceoverText, voice: pipeline.ttsVoice ?? "aoede",
              }),
              ...(lease ? { stageAttemptId: lease.stageAttemptId, leaseOwner: lease.leaseOwner } : {}),
            });
            await saveAudioSpec(input.pipelineId, input.userId, {
              audioFilePath: sound.audioFilePath,
              artifactKey,
            }, lease);
            await syncCost(lease);
            return { artifactKey };
          }
          case "alignment": {
            const videoSpec = pipeline.videoSpec as VideoSpec | null;
            const soundSpec = pipeline.soundSpec as { audioFilePath?: string; artifactKey?: string } | null;
            if (!videoSpec || !soundSpec) throw new Error("Audio checkpoint is incomplete");
            const audioPath = soundSpec.audioFilePath ?? `src/audio/${input.pipelineId}.wav`;
            if (!fs.existsSync(audioPath)) {
              if (!soundSpec.artifactKey || !(await restoreWorkflowFile({
                pipelineId: input.pipelineId, userId: input.userId,
                artifactKey: soundSpec.artifactKey, destination: audioPath,
              }))) throw new Error("Durable narration artifact is unavailable");
            }
            const captions = await forcedAlignmentAgent(audioPath, videoSpec.voiceoverText, metering);
            await syncCost(lease);
            return { captions };
          }
          case "video": {
            const videoSpec = pipeline.videoSpec as VideoSpec | null;
            if (!videoSpec) throw new Error("Video spec checkpoint is incomplete");
            const backgroundPath = await generateAiVideoClips(
              videoSpec.scenes, input.pipelineId, pipeline.videoModel as VideoModel, metering,
            );
            const artifactKey = workflowArtifactKey(EXPLAINER_WORKFLOW_VERSION, "video", "background");
            await persistWorkflowFile({
              pipelineId: input.pipelineId, userId: input.userId, artifactKey,
              kind: "background_video", filePath: backgroundPath, extension: "mp4",
              contentType: "video/mp4", fingerprint: stableFingerprint({
                scenes: videoSpec.scenes, model: pipeline.videoModel,
              }),
              ...(lease ? { stageAttemptId: lease.stageAttemptId, leaseOwner: lease.leaseOwner } : {}),
            });
            await syncCost(lease);
            return { artifactKey };
          }
          case "thumbnail": {
            if (!durationPolicy.includeThumbnail) return { skipped: true };
            const videoSpec = pipeline.videoSpec as VideoSpec | null;
            if (!videoSpec) throw new Error("Video spec checkpoint is incomplete");
            try {
              const { data } = await generateThumbnailOpenRouter(
                videoSpec, pipeline.claudeModel, "google/gemini-3.1-flash-image", metering,
              );
              const localPath = path.join("src/video", `${input.pipelineId}-thumbnail.jpg`);
              await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
              await fs.promises.writeFile(localPath, data);
              const artifactKey = workflowArtifactKey(EXPLAINER_WORKFLOW_VERSION, "image", "thumbnail");
              await persistWorkflowFile({
                pipelineId: input.pipelineId, userId: input.userId, artifactKey,
                kind: "thumbnail", filePath: localPath, extension: "jpg",
                contentType: "image/jpeg",
                ...(lease ? { stageAttemptId: lease.stageAttemptId, leaseOwner: lease.leaseOwner } : {}),
              });
              const { url } = await runWithActiveStageLease(
                lease,
                () => uploadThumbnailToS3(data, input.pipelineId),
              );
              await saveThumbnailUrl(input.pipelineId, input.userId, url, lease);
              await syncCost(lease);
              return { artifactKey };
            } catch (error) {
              await syncCost(lease);
              console.warn(`[pipeline:${input.pipelineId}] thumbnail skipped:`, error);
              return { skipped: true };
            }
          }
          case "render": {
            const alignment = output<{ captions: Caption[] }>(outputs, "alignment");
            const video = output<{ artifactKey: string }>(outputs, "video");
            if (!alignment?.captions || !video?.artifactKey) {
              throw new Error("Durable alignment or background output is unavailable");
            }
            const backgroundPath = path.join("src/video", input.pipelineId, "bg-assembled.mp4");
            if (!fs.existsSync(backgroundPath)) await restoreWorkflowFile({
              pipelineId: input.pipelineId, userId: input.userId,
              artifactKey: video.artifactKey, destination: backgroundPath,
            });
            const soundSpec = pipeline.soundSpec as { audioFilePath?: string; artifactKey?: string } | null;
            const audioPath = `src/audio/${input.pipelineId}.wav`;
            if (!fs.existsSync(audioPath) && soundSpec?.artifactKey) await restoreWorkflowFile({
              pipelineId: input.pipelineId, userId: input.userId,
              artifactKey: soundSpec.artifactKey, destination: audioPath,
            });
            let finalPath = await compositeVideo(input.pipelineId, alignment.captions, backgroundPath, [], {
              captionPreset: pipeline.captionPreset,
              channelStyle: pipeline.channelStyle,
            });
            const thumbnail = output<{ artifactKey?: string; skipped?: boolean }>(outputs, "thumbnail");
            if (thumbnail?.artifactKey) {
              const thumbnailPath = path.join("src/video", `${input.pipelineId}-thumbnail.jpg`);
              if (!fs.existsSync(thumbnailPath)) await restoreWorkflowFile({
                pipelineId: input.pipelineId, userId: input.userId,
                artifactKey: thumbnail.artifactKey, destination: thumbnailPath,
              });
              finalPath = await burnThumbnailIntoVideo(
                finalPath, await fs.promises.readFile(thumbnailPath), input.pipelineId,
              );
            }
            const durationSeconds = await getVideoDuration(finalPath);
            await durationPolicy.validateRenderedVideo(finalPath, durationSeconds);
            const artifactKey = workflowArtifactKey(EXPLAINER_WORKFLOW_VERSION, "video", "rendered");
            await persistWorkflowFile({
              pipelineId: input.pipelineId, userId: input.userId, artifactKey,
              kind: "rendered_video", filePath: finalPath, extension: "mp4",
              contentType: "video/mp4",
              ...(lease ? { stageAttemptId: lease.stageAttemptId, leaseOwner: lease.leaseOwner } : {}),
            });
            return { artifactKey, durationSeconds };
          }
          case "upload": {
            const rendered = output<{ artifactKey: string; durationSeconds: number }>(outputs, "render");
            if (!rendered) throw new Error("Rendered artifact checkpoint is missing");
            const finalPath = path.join("src/video", `${input.pipelineId}-durable-output.mp4`);
            if (!fs.existsSync(finalPath)) await restoreWorkflowFile({
              pipelineId: input.pipelineId, userId: input.userId,
              artifactKey: rendered.artifactKey, destination: finalPath,
            });
            const { key } = await runWithActiveStageLease(
              lease,
              () => uploadToS3(finalPath, input.pipelineId),
            );
            await saveVideoOutput(
              input.pipelineId,
              input.userId,
              key,
              rendered.durationSeconds,
              lease,
            );
            await syncCost(lease);
            return { s3key: key, durationSeconds: rendered.durationSeconds };
          }
          case "notify": {
            const user = await getUser(input.userId);
            if (user) {
              const { subject, html } = reelReadyEmailTemplate(user.name, pipeline.topic);
              await runWithActiveStageLease(lease, () => emailQueue.add(
                "reel-ready",
                { to: user.email, subject, html },
                { jobId: reelReadyNotificationJobId(input.pipelineId) },
              ));
            }
            return { queued: Boolean(user) };
          }
          case "publish": {
            if (!input.autoPublish) return { skipped: true };
            return attemptAutoPublish(input.pipelineId, async () => {
              const finalScript = pipeline.finalScript as ScriptOutput | null;
              if (!finalScript) throw new Error("Final script is unavailable for publishing");
              const hashtags = finalScript.hashtags
                .map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" ");
              const title = `${finalScript.titleOptions[0]!} ${hashtags}`.trim();
              return runWithActiveStageLease(
                lease,
                () => uploadToTiktokService(
                  input.userId, input.pipelineId, title, "PUBLIC_TO_EVERYONE",
                  false, false, false, false, false, true, lease,
                ),
              );
            });
          }
        }
      },
    },
  });
  return load();
}
