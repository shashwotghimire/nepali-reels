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

export type ProviderAttemptStatus = "pending" | "succeeded" | "failed" | "retried";
export type CostProvenance = "actual" | "estimated" | "unknown";

export interface ProviderUsageMetrics {
  inputTokens: number | null;
  outputTokens: number | null;
  cacheWriteTokens: number | null;
  cacheReadTokens: number | null;
  audioInputSeconds: string | number | null;
  audioOutputSeconds: string | number | null;
  audioCharacters: number | null;
  generatedVideoSeconds: string | number | null;
  imageCount: number | null;
  imageUsage: object | null;
}

export class ProviderUsage extends Model<
  InferAttributes<ProviderUsage>,
  InferCreationAttributes<ProviderUsage>
> {
  declare attemptId: string;
  declare userId: ForeignKey<string>;
  declare pipelineId: string;
  declare retryOfAttemptId: CreationOptional<string | null>;
  declare operation: string;
  declare stage: string;
  declare provider: string;
  declare model: string | null;
  declare configuration: CreationOptional<object | null>;
  declare status: CreationOptional<ProviderAttemptStatus>;
  declare inputTokens: CreationOptional<number | null>;
  declare outputTokens: CreationOptional<number | null>;
  declare cacheWriteTokens: CreationOptional<number | null>;
  declare cacheReadTokens: CreationOptional<number | null>;
  declare audioInputSeconds: CreationOptional<string | null>;
  declare audioOutputSeconds: CreationOptional<string | null>;
  declare audioCharacters: CreationOptional<number | null>;
  declare generatedVideoSeconds: CreationOptional<string | null>;
  declare imageCount: CreationOptional<number | null>;
  declare imageUsage: CreationOptional<object | null>;
  declare costUsd: CreationOptional<string | null>;
  declare currency: CreationOptional<"USD">;
  declare costProvenance: CreationOptional<CostProvenance>;
  declare rateVersion: CreationOptional<string | null>;
  declare errorMessage: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

ProviderUsage.init(
  {
    attemptId: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: { model: User, key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    pipelineId: {
      type: DataTypes.UUID,
      allowNull: false,
      // Historical attempts keep the pipeline UUID when the reel is deleted.
    },
    retryOfAttemptId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "provider_usage", key: "attemptId" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    operation: { type: DataTypes.STRING, allowNull: false },
    stage: { type: DataTypes.STRING, allowNull: false },
    provider: { type: DataTypes.STRING, allowNull: false },
    model: { type: DataTypes.STRING, allowNull: true },
    configuration: { type: DataTypes.JSONB, allowNull: true },
    status: {
      type: DataTypes.ENUM("pending", "succeeded", "failed", "retried"),
      allowNull: false,
      defaultValue: "pending",
    },
    inputTokens: { type: DataTypes.INTEGER, allowNull: true },
    outputTokens: { type: DataTypes.INTEGER, allowNull: true },
    cacheWriteTokens: { type: DataTypes.INTEGER, allowNull: true },
    cacheReadTokens: { type: DataTypes.INTEGER, allowNull: true },
    audioInputSeconds: { type: DataTypes.DECIMAL(14, 3), allowNull: true },
    audioOutputSeconds: { type: DataTypes.DECIMAL(14, 3), allowNull: true },
    audioCharacters: { type: DataTypes.INTEGER, allowNull: true },
    generatedVideoSeconds: { type: DataTypes.DECIMAL(14, 3), allowNull: true },
    imageCount: { type: DataTypes.INTEGER, allowNull: true },
    imageUsage: { type: DataTypes.JSONB, allowNull: true },
    costUsd: { type: DataTypes.DECIMAL(18, 8), allowNull: true },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "USD" },
    costProvenance: {
      type: DataTypes.ENUM("actual", "estimated", "unknown"),
      allowNull: false,
      defaultValue: "unknown",
    },
    rateVersion: { type: DataTypes.STRING, allowNull: true },
    errorMessage: { type: DataTypes.TEXT, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, modelName: "ProviderUsage", tableName: "provider_usage" },
);

export default ProviderUsage;
