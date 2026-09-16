import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import sequelize from "../configs/db.config";

export default class ScriptRevisionRequest extends Model<InferAttributes<ScriptRevisionRequest>, InferCreationAttributes<ScriptRevisionRequest>> {
  declare id: CreationOptional<string>;
  declare pipelineId: string;
  declare userId: string;
  declare idempotencyKey: string;
  declare scriptVersion: number;
  declare status: "running" | "succeeded" | "failed";
  declare result: CreationOptional<object | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

ScriptRevisionRequest.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  pipelineId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.STRING, allowNull: false },
  idempotencyKey: { type: DataTypes.STRING, allowNull: false },
  scriptVersion: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false },
  result: { type: DataTypes.JSONB, allowNull: true },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE,
}, { sequelize, tableName: "script_revision_requests", modelName: "ScriptRevisionRequest" });
