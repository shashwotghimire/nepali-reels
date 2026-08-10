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
import type { PipelineStatus } from "../types/pipeline.types";

export class Reels extends Model<
  InferAttributes<Reels>,
  InferCreationAttributes<Reels>
> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<string>;
  declare topic: string;
  declare claudeModel: string;
  declare videoModel: string;
  declare draftScript: CreationOptional<object | null>;
  declare finalScript: CreationOptional<object | null>;
  declare videoSpec: CreationOptional<object | null>;
  declare soundSpec: CreationOptional<object | null>;
  declare pipelineStatus: PipelineStatus;
  declare videoDurationSec: CreationOptional<number | null>;
  declare s3key: CreationOptional<string | null>;
  declare tiktokPublishId: CreationOptional<string | null>;
  declare thumbnailUrl: CreationOptional<string | null>;
  declare costUsd: CreationOptional<number | null>;
  declare ttsVoice: CreationOptional<string | null>;
  declare failureReason: CreationOptional<string | null>;
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
    thumbnailUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    costUsd: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    ttsVoice: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
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
