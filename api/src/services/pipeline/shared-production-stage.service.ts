import fs from "node:fs";
import path from "node:path";
import type Reels from "../../models/reels.model";
import type { Caption } from "../../types/subtitle.types";
import type { VideoModel } from "../../constants/constant";
import type { WorkflowStage } from "../../helpers/workflow.helper";
import { stableFingerprint, workflowArtifactKey } from "../../helpers/workflow-artifact.helper";
import {
  saveAudioSpec,
  savePipelineCost,
  saveThumbnailUrl,
  saveVideoOutput,
} from "../../repositories/reels.repository";
import { getPipelineCostSummary } from "../../repositories/provider-usage.repository";
import { generateAiVideoClips } from "./agents/ai-video-generator.agent";
import { forcedAlignmentAgent } from "./agents/forced-alignment.agent";
import { generateThumbnailOpenRouter } from "./agents/thumbnail.agent";
import { generateTextToSpeechAgent } from "./agents/tts.agent";
import {
  burnThumbnailIntoVideo,
  compositeVideo,
  getVideoDuration,
} from "../../helpers/video.helper";
import { persistWorkflowFile, restoreWorkflowFile } from "./workflow-artifact.service";
import { uploadThumbnailToS3, uploadToS3 } from "../s3.service";
import { runWithActiveStageLease } from "./workflow-lease.service";
import { getUser } from "../../repositories/user.repository";
import { reelReadyEmailTemplate } from "../../utils/email-templates.util";
import { emailQueue } from "../../queue/email.queue";
import { reelReadyNotificationJobId } from "../../helpers/notification.helper";
import { attemptAutoPublish } from "./auto-publish.service";
import { uploadToTiktokService } from "../tiktok.service";
import type { MeteringContext } from "./llm-metering";
import type { WorkflowStageLease } from "./workflow-dispatcher.service";
import type { createExplainerDurationPolicy } from "./explainer-duration-policy.service";
import { buildCompositionOverlays } from "../../helpers/composition-overlay.helper";

export interface ProductionScene {
  startSec: number;
  endSec: number;
  bgPrompt: string;
  captionText: string;
  onScreenText?: string;
}

export interface ProductionVideoSpec {
  voiceoverText: string;
  scenes: ProductionScene[];
  musicDirection: string;
  thumbnailText: string;
}

export interface PublicationMetadata {
  titleOptions: string[];
  hashtags: string[];
}

type DurationPolicy = ReturnType<typeof createExplainerDurationPolicy>;
type StageOutput = Record<string, unknown>;

function output<T extends StageOutput>(
  outputs: ReadonlyMap<WorkflowStage, object | null>,
  stage: WorkflowStage,
): T | null {
  return (outputs.get(stage) as T | null | undefined) ?? null;
}

export async function executeSharedProductionStage(input: {
  stage: WorkflowStage;
  outputs: ReadonlyMap<WorkflowStage, object | null>;
  lease: WorkflowStageLease;
  pipeline: Reels;
  userId: string;
  pipelineId: string;
  workflowVersion: number;
  autoPublish: boolean;
  metering: MeteringContext;
  durationPolicy: DurationPolicy;
  videoSpec: ProductionVideoSpec;
  publication: PublicationMetadata;
}): Promise<object | null> {
  const syncCost = async () => {
    const summary = await getPipelineCostSummary(input.pipelineId, input.userId);
    await savePipelineCost(
      input.pipelineId, input.userId, summary.knownCostUsd, true, input.lease,
    );
  };

  switch (input.stage) {
    case "audio": {
      const sound = await generateTextToSpeechAgent(
        input.videoSpec,
        input.pipelineId,
        input.pipeline.ttsVoice ?? "aoede",
        input.metering,
      );
      const artifactKey = workflowArtifactKey(input.workflowVersion, "audio", "narration");
      await persistWorkflowFile({
        pipelineId: input.pipelineId,
        userId: input.userId,
        artifactKey,
        kind: "audio",
        filePath: sound.audioFilePath,
        extension: "wav",
        contentType: "audio/wav",
        fingerprint: stableFingerprint({
          text: input.videoSpec.voiceoverText,
          voice: input.pipeline.ttsVoice ?? "aoede",
          videoType: input.pipeline.videoType,
        }),
        stageAttemptId: input.lease.stageAttemptId,
        leaseOwner: input.lease.leaseOwner,
      });
      await saveAudioSpec(input.pipelineId, input.userId, {
        audioFilePath: sound.audioFilePath,
        artifactKey,
      }, input.lease);
      await syncCost();
      return { artifactKey };
    }
    case "alignment": {
      const soundSpec = input.pipeline.soundSpec as {
        audioFilePath?: string;
        artifactKey?: string;
      } | null;
      if (!soundSpec) throw new Error("Audio checkpoint is incomplete");
      const audioPath = soundSpec.audioFilePath ?? `src/audio/${input.pipelineId}.wav`;
      if (!fs.existsSync(audioPath)) {
        if (!soundSpec.artifactKey || !(await restoreWorkflowFile({
          pipelineId: input.pipelineId,
          userId: input.userId,
          artifactKey: soundSpec.artifactKey,
          destination: audioPath,
        }))) throw new Error("Durable narration artifact is unavailable");
      }
      const captions = await forcedAlignmentAgent(
        audioPath, input.videoSpec.voiceoverText, input.metering,
      );
      await syncCost();
      return { captions };
    }
    case "video": {
      const backgroundPath = await generateAiVideoClips(
        input.videoSpec.scenes,
        input.pipelineId,
        input.pipeline.videoModel as VideoModel,
        input.metering,
        input.workflowVersion,
      );
      const artifactKey = workflowArtifactKey(input.workflowVersion, "video", "background");
      await persistWorkflowFile({
        pipelineId: input.pipelineId,
        userId: input.userId,
        artifactKey,
        kind: "background_video",
        filePath: backgroundPath,
        extension: "mp4",
        contentType: "video/mp4",
        fingerprint: stableFingerprint({
          scenes: input.videoSpec.scenes,
          model: input.pipeline.videoModel,
          videoType: input.pipeline.videoType,
        }),
        stageAttemptId: input.lease.stageAttemptId,
        leaseOwner: input.lease.leaseOwner,
      });
      await syncCost();
      return { artifactKey };
    }
    case "thumbnail": {
      if (!input.durationPolicy.includeThumbnail) return { skipped: true };
      try {
        const { data } = await generateThumbnailOpenRouter(
          input.videoSpec,
          input.pipeline.claudeModel,
          "google/gemini-3.1-flash-image",
          input.metering,
        );
        const localPath = path.join("src/video", `${input.pipelineId}-thumbnail.jpg`);
        await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
        await fs.promises.writeFile(localPath, data);
        const artifactKey = workflowArtifactKey(input.workflowVersion, "image", "thumbnail");
        await persistWorkflowFile({
          pipelineId: input.pipelineId,
          userId: input.userId,
          artifactKey,
          kind: "thumbnail",
          filePath: localPath,
          extension: "jpg",
          contentType: "image/jpeg",
          stageAttemptId: input.lease.stageAttemptId,
          leaseOwner: input.lease.leaseOwner,
        });
        const { url } = await runWithActiveStageLease(
          input.lease,
          () => uploadThumbnailToS3(data, input.pipelineId),
        );
        await saveThumbnailUrl(input.pipelineId, input.userId, url, input.lease);
        await syncCost();
        return { artifactKey };
      } catch (error) {
        await syncCost();
        console.warn(`[pipeline:${input.pipelineId}] thumbnail skipped:`, error);
        return { skipped: true };
      }
    }
    case "render": {
      const alignment = output<{ captions: Caption[] }>(input.outputs, "alignment");
      const video = output<{ artifactKey: string }>(input.outputs, "video");
      if (!alignment?.captions || !video?.artifactKey) {
        throw new Error("Durable alignment or background output is unavailable");
      }
      const backgroundPath = path.join("src/video", input.pipelineId, "bg-assembled.mp4");
      if (!fs.existsSync(backgroundPath)) await restoreWorkflowFile({
        pipelineId: input.pipelineId,
        userId: input.userId,
        artifactKey: video.artifactKey,
        destination: backgroundPath,
      });
      const soundSpec = input.pipeline.soundSpec as { artifactKey?: string } | null;
      const audioPath = `src/audio/${input.pipelineId}.wav`;
      if (!fs.existsSync(audioPath) && soundSpec?.artifactKey) await restoreWorkflowFile({
        pipelineId: input.pipelineId,
        userId: input.userId,
        artifactKey: soundSpec.artifactKey,
        destination: audioPath,
      });
      let finalPath = await compositeVideo(
        input.pipelineId,
        alignment.captions,
        backgroundPath,
        buildCompositionOverlays(input.videoSpec.scenes),
        { captionPreset: input.pipeline.captionPreset, channelStyle: input.pipeline.channelStyle },
      );
      const thumbnail = output<{ artifactKey?: string }>(input.outputs, "thumbnail");
      if (thumbnail?.artifactKey) {
        const thumbnailPath = path.join("src/video", `${input.pipelineId}-thumbnail.jpg`);
        if (!fs.existsSync(thumbnailPath)) await restoreWorkflowFile({
          pipelineId: input.pipelineId,
          userId: input.userId,
          artifactKey: thumbnail.artifactKey,
          destination: thumbnailPath,
        });
        finalPath = await burnThumbnailIntoVideo(
          finalPath, await fs.promises.readFile(thumbnailPath), input.pipelineId,
        );
      }
      const durationSeconds = await getVideoDuration(finalPath);
      await input.durationPolicy.validateRenderedVideo(finalPath, durationSeconds);
      const artifactKey = workflowArtifactKey(input.workflowVersion, "video", "rendered");
      await persistWorkflowFile({
        pipelineId: input.pipelineId,
        userId: input.userId,
        artifactKey,
        kind: "rendered_video",
        filePath: finalPath,
        extension: "mp4",
        contentType: "video/mp4",
        stageAttemptId: input.lease.stageAttemptId,
        leaseOwner: input.lease.leaseOwner,
      });
      return { artifactKey, durationSeconds };
    }
    case "upload": {
      const rendered = output<{ artifactKey: string; durationSeconds: number }>(
        input.outputs, "render",
      );
      if (!rendered) throw new Error("Rendered artifact checkpoint is missing");
      const finalPath = path.join("src/video", `${input.pipelineId}-durable-output.mp4`);
      if (!fs.existsSync(finalPath)) await restoreWorkflowFile({
        pipelineId: input.pipelineId,
        userId: input.userId,
        artifactKey: rendered.artifactKey,
        destination: finalPath,
      });
      const { key } = await runWithActiveStageLease(
        input.lease,
        () => uploadToS3(finalPath, input.pipelineId),
      );
      await saveVideoOutput(
        input.pipelineId, input.userId, key, rendered.durationSeconds, input.lease,
      );
      await syncCost();
      return { s3key: key, durationSeconds: rendered.durationSeconds };
    }
    case "notify": {
      const user = await getUser(input.userId);
      if (user) {
        const { subject, html } = reelReadyEmailTemplate(user.name, input.pipeline.topic);
        await runWithActiveStageLease(input.lease, () => emailQueue.add(
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
        const hashtags = input.publication.hashtags
          .map((tag) => tag.startsWith("#") ? tag : `#${tag}`)
          .join(" ");
        const title = `${input.publication.titleOptions[0] ?? input.pipeline.topic} ${hashtags}`.trim();
        return runWithActiveStageLease(input.lease, () => uploadToTiktokService(
          input.userId,
          input.pipelineId,
          title,
          "PUBLIC_TO_EVERYONE",
          false,
          false,
          false,
          false,
          false,
          true,
          input.lease,
        ));
      });
    }
    default:
      throw new Error(`Stage ${input.stage} is not a shared production stage`);
  }
}
