import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import sequelize from "../configs/db.config";
import Reels from "./reels.model";
import User from "./users.model";

export class PipelineBudgetCounter extends Model<InferAttributes<PipelineBudgetCounter>, InferCreationAttributes<PipelineBudgetCounter>> {
  declare pipelineId: ForeignKey<string>;
  declare userId: ForeignKey<string>;
  declare reservedProviderCalls: CreationOptional<number>;
  declare consumedProviderCalls: CreationOptional<number>;
  declare reservedInputTokens: CreationOptional<string>;
  declare consumedInputTokens: CreationOptional<string>;
  declare reservedOutputTokens: CreationOptional<string>;
  declare consumedOutputTokens: CreationOptional<string>;
  declare reservedSearches: CreationOptional<number>;
  declare consumedSearches: CreationOptional<number>;
  declare reservedGeneratedSeconds: CreationOptional<string>;
  declare consumedGeneratedSeconds: CreationOptional<string>;
  declare reservedAiRevisions: CreationOptional<number>;
  declare consumedAiRevisions: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

PipelineBudgetCounter.init({
  pipelineId: { type: DataTypes.UUID, primaryKey: true, allowNull: false, references: { model: Reels, key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
  userId: { type: DataTypes.STRING, allowNull: false, references: { model: User, key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
  reservedProviderCalls: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  consumedProviderCalls: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  reservedInputTokens: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
  consumedInputTokens: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
  reservedOutputTokens: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
  consumedOutputTokens: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
  reservedSearches: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  consumedSearches: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  reservedGeneratedSeconds: { type: DataTypes.DECIMAL(14, 3), allowNull: false, defaultValue: 0 },
  consumedGeneratedSeconds: { type: DataTypes.DECIMAL(14, 3), allowNull: false, defaultValue: 0 },
  reservedAiRevisions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  consumedAiRevisions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE,
}, { sequelize, modelName: "PipelineBudgetCounter", tableName: "pipeline_budget_counters" });

export default PipelineBudgetCounter;
