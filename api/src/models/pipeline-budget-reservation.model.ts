import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import sequelize from "../configs/db.config";
import Reels from "./reels.model";
import User from "./users.model";
import WorkflowStageAttempt from "./workflow-stage-attempt.model";

export type PipelineBudgetReservationStatus = "reserved" | "settled" | "released";

export class PipelineBudgetReservation extends Model<InferAttributes<PipelineBudgetReservation>, InferCreationAttributes<PipelineBudgetReservation>> {
  declare id: string;
  declare pipelineId: ForeignKey<string>;
  declare userId: ForeignKey<string>;
  declare stageAttemptId: CreationOptional<ForeignKey<string> | null>;
  declare status: CreationOptional<PipelineBudgetReservationStatus>;
  declare requestedProviderCalls: number;
  declare requestedInputTokens: string;
  declare requestedOutputTokens: string;
  declare requestedSearches: number;
  declare requestedGeneratedSeconds: string;
  declare requestedAiRevisions: number;
  declare actualProviderCalls: CreationOptional<number | null>;
  declare actualInputTokens: CreationOptional<string | null>;
  declare actualOutputTokens: CreationOptional<string | null>;
  declare actualSearches: CreationOptional<number | null>;
  declare actualGeneratedSeconds: CreationOptional<string | null>;
  declare actualAiRevisions: CreationOptional<number | null>;
  declare releaseReason: CreationOptional<string | null>;
  declare settledAt: CreationOptional<Date | null>;
  declare releasedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

PipelineBudgetReservation.init({
  id: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
  pipelineId: { type: DataTypes.UUID, allowNull: false, references: { model: Reels, key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
  userId: { type: DataTypes.STRING, allowNull: false, references: { model: User, key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
  stageAttemptId: { type: DataTypes.UUID, allowNull: true, references: { model: WorkflowStageAttempt, key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
  status: { type: DataTypes.ENUM("reserved", "settled", "released"), allowNull: false, defaultValue: "reserved" },
  requestedProviderCalls: { type: DataTypes.INTEGER, allowNull: false },
  requestedInputTokens: { type: DataTypes.BIGINT, allowNull: false },
  requestedOutputTokens: { type: DataTypes.BIGINT, allowNull: false },
  requestedSearches: { type: DataTypes.INTEGER, allowNull: false },
  requestedGeneratedSeconds: { type: DataTypes.DECIMAL(14, 3), allowNull: false },
  requestedAiRevisions: { type: DataTypes.INTEGER, allowNull: false },
  actualProviderCalls: { type: DataTypes.INTEGER, allowNull: true },
  actualInputTokens: { type: DataTypes.BIGINT, allowNull: true },
  actualOutputTokens: { type: DataTypes.BIGINT, allowNull: true },
  actualSearches: { type: DataTypes.INTEGER, allowNull: true },
  actualGeneratedSeconds: { type: DataTypes.DECIMAL(14, 3), allowNull: true },
  actualAiRevisions: { type: DataTypes.INTEGER, allowNull: true },
  releaseReason: { type: DataTypes.TEXT, allowNull: true },
  settledAt: { type: DataTypes.DATE, allowNull: true },
  releasedAt: { type: DataTypes.DATE, allowNull: true },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE,
}, { sequelize, modelName: "PipelineBudgetReservation", tableName: "pipeline_budget_reservations" });

export default PipelineBudgetReservation;
