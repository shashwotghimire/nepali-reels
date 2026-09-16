import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import sequelize from "../configs/db.config";
import User from "./users.model";
import type { ChannelStyleSnapshot, PipelineContentInput, PipelineStatus, VideoType } from "../types/pipeline.types";

export class Reels extends Model<
  InferAttributes<Reels>,
  InferCreationAttributes<Reels>
> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<string>;
  declare topic: string;
  declare claudeModel: string;
  declare videoModel: string;
  declare videoType: CreationOptional<VideoType>;
  declare contentInput: CreationOptional<PipelineContentInput>;
  declare workflowVersion: CreationOptional<number>;
  declare draftScript: CreationOptional<object | null>;
  declare finalScript: CreationOptional<object | null>;
  declare videoSpec: CreationOptional<object | null>;
  declare soundSpec: CreationOptional<object | null>;
  declare pipelineStatus: PipelineStatus;
  declare videoDurationSec: CreationOptional<number | null>;
  declare s3key: CreationOptional<string | null>;
  declare tiktokPublishId: CreationOptional<string | null>;
  declare tiktokSubmissionState: CreationOptional<"submitting" | "submitted" | null>;
  declare tiktokSubmissionAttemptId: CreationOptional<string | null>;
  declare thumbnailUrl: CreationOptional<string | null>;
  declare costUsd: CreationOptional<number | null>;
  declare legacyCostUsd: CreationOptional<number | null>;
  declare costEstimateIncomplete: CreationOptional<boolean>;
  declare ttsVoice: CreationOptional<string | null>;
  declare failureReason: CreationOptional<string | null>;
  declare scriptVersion: CreationOptional<number>;
  declare scriptRevisionCount: CreationOptional<number>;
  declare scriptApprovedAt: CreationOptional<Date | null>;
  declare approvedScriptFingerprint: CreationOptional<string | null>;
  declare captionPreset: CreationOptional<"default" | "bold" | "minimal">;
  declare channelStyle: CreationOptional<ChannelStyleSnapshot | null>;
  declare thumbnailVersions: CreationOptional<Array<{ version: number; url: string; artifactKey: string }> | null>;
  declare selectedThumbnailVersion: CreationOptional<number | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Reels.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: { model: User, key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    topic: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    claudeModel: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    videoModel: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    videoType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "explainer",
    },
    contentInput: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: { videoType: "explainer" },
    },
    workflowVersion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    draftScript: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    finalScript: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    videoSpec: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    soundSpec: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    pipelineStatus: {
      type: DataTypes.ENUM(
        "queued",
        "script_generated",
        "script_finalised",
        "linguistic_reviewed",
        "awaiting_script_approval",
        "video_spec_generated",
        "sound_generated",
        "video_generated",
        "publish_pending",
        "published",
        "failed",
      ),
      allowNull: false,
      defaultValue: "queued",
    },
    videoDurationSec: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    s3key: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    tiktokPublishId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    tiktokSubmissionState: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    tiktokSubmissionAttemptId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    thumbnailUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    costUsd: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    legacyCostUsd: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    costEstimateIncomplete: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    ttsVoice: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    scriptVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    scriptRevisionCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    scriptApprovedAt: { type: DataTypes.DATE, allowNull: true },
    approvedScriptFingerprint: { type: DataTypes.STRING, allowNull: true },
    captionPreset: { type: DataTypes.STRING, allowNull: false, defaultValue: "default" },
    channelStyle: { type: DataTypes.JSONB, allowNull: true },
    thumbnailVersions: { type: DataTypes.JSONB, allowNull: true },
    selectedThumbnailVersion: { type: DataTypes.INTEGER, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: "Reels",
    tableName: "reels",
  },
);

export default Reels;
