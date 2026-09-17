import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import sequelize from "../configs/db.config";

export default class ScriptRevisionRequest extends Model<InferAttributes<ScriptRevisionRequest>, InferCreationAttributes<ScriptRevisionRequest>> {
  declare id: CreationOptional<string>;
  declare pipelineId: string;
  declare userId: string;
  declare idempotencyKey: string;
  declare scriptVersion: number;
  declare instruction: CreationOptional<string | null>;
  declare status: "reserved" | "submitted" | "provider_succeeded" | "applied" | "failed" | "uncertain" | "abandoned";
  declare result: CreationOptional<object | null>;
  declare leaseOwner: string;
  declare leaseExpiresAt: Date;
  declare error: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

ScriptRevisionRequest.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  pipelineId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.STRING, allowNull: false },
  idempotencyKey: { type: DataTypes.STRING, allowNull: false },
  scriptVersion: { type: DataTypes.INTEGER, allowNull: false },
  instruction: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.STRING, allowNull: false },
  result: { type: DataTypes.JSONB, allowNull: true },
  leaseOwner: { type: DataTypes.STRING, allowNull: false },
  leaseExpiresAt: { type: DataTypes.DATE, allowNull: false },
  error: { type: DataTypes.TEXT, allowNull: true },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE,
}, { sequelize, tableName: "script_revision_requests", modelName: "ScriptRevisionRequest" });
