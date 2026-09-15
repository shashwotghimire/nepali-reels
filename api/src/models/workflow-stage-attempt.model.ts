import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import sequelize from "../configs/db.config";
import Reels from "./reels.model";

export type WorkflowStageAttemptStatus = "running" | "succeeded" | "failed";

export class WorkflowStageAttempt extends Model<InferAttributes<WorkflowStageAttempt>, InferCreationAttributes<WorkflowStageAttempt>> {
  declare id: string;
  declare pipelineId: ForeignKey<string>;
  declare workflowVersion: number;
  declare stage: string;
  declare executionKey: string;
  declare status: CreationOptional<WorkflowStageAttemptStatus>;
  declare leaseOwner: CreationOptional<string | null>;
  declare leaseExpiresAt: CreationOptional<Date | null>;
  declare providerAttemptId: CreationOptional<string | null>;
  declare input: CreationOptional<object | null>;
  declare output: CreationOptional<object | null>;
  declare errorMessage: CreationOptional<string | null>;
  declare startedAt: Date;
  declare completedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

WorkflowStageAttempt.init({
  id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
  pipelineId: { type: DataTypes.UUID, allowNull: false, references: { model: Reels, key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
  workflowVersion: { type: DataTypes.INTEGER, allowNull: false },
  stage: { type: DataTypes.STRING, allowNull: false },
  executionKey: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.ENUM("running", "succeeded", "failed"), allowNull: false, defaultValue: "running" },
  leaseOwner: { type: DataTypes.STRING, allowNull: true },
  leaseExpiresAt: { type: DataTypes.DATE, allowNull: true },
  providerAttemptId: { type: DataTypes.UUID, allowNull: true, unique: true },
  input: { type: DataTypes.JSONB, allowNull: true },
  output: { type: DataTypes.JSONB, allowNull: true },
  errorMessage: { type: DataTypes.TEXT, allowNull: true },
  startedAt: { type: DataTypes.DATE, allowNull: false },
  completedAt: { type: DataTypes.DATE, allowNull: true },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE,
}, { sequelize, modelName: "WorkflowStageAttempt", tableName: "workflow_stage_attempts" });

export default WorkflowStageAttempt;
