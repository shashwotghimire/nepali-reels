import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import sequelize from "../configs/db.config";
import Reels from "./reels.model";
import WorkflowStageAttempt from "./workflow-stage-attempt.model";

export class WorkflowArtifact extends Model<InferAttributes<WorkflowArtifact>, InferCreationAttributes<WorkflowArtifact>> {
  declare id: string;
  declare pipelineId: ForeignKey<string>;
  declare stageAttemptId: CreationOptional<ForeignKey<string> | null>;
  declare artifactKey: string;
  declare kind: string;
  declare storageProvider: string;
  declare storageKey: string;
  declare contentType: CreationOptional<string | null>;
  declare byteSize: CreationOptional<string | null>;
  declare checksum: CreationOptional<string | null>;
  declare fingerprint: CreationOptional<string | null>;
  declare metadata: CreationOptional<object | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

WorkflowArtifact.init({
  id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
  pipelineId: { type: DataTypes.UUID, allowNull: false, references: { model: Reels, key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
  stageAttemptId: { type: DataTypes.UUID, allowNull: true, references: { model: WorkflowStageAttempt, key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
  artifactKey: { type: DataTypes.STRING, allowNull: false },
  kind: { type: DataTypes.STRING, allowNull: false },
  storageProvider: { type: DataTypes.STRING, allowNull: false },
  storageKey: { type: DataTypes.TEXT, allowNull: false },
  contentType: { type: DataTypes.STRING, allowNull: true },
  byteSize: { type: DataTypes.BIGINT, allowNull: true },
  checksum: { type: DataTypes.STRING, allowNull: true },
  fingerprint: { type: DataTypes.STRING, allowNull: true },
  metadata: { type: DataTypes.JSONB, allowNull: true },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE,
}, { sequelize, modelName: "WorkflowArtifact", tableName: "workflow_artifacts" });

export default WorkflowArtifact;
