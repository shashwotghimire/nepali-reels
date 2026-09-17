import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import sequelize from "../configs/db.config";

export default class ThumbnailGenerationRequest extends Model<InferAttributes<ThumbnailGenerationRequest>, InferCreationAttributes<ThumbnailGenerationRequest>> {
  declare id: CreationOptional<string>;
  declare pipelineId: string;
  declare userId: string;
  declare idempotencyKey: string;
  declare version: number;
  declare status: "reserved" | "submitted" | "provider_succeeded" | "completed" | "failed" | "uncertain" | "abandoned";
  declare leaseOwner: string;
  declare leaseExpiresAt: Date;
  declare url: CreationOptional<string | null>;
  declare error: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

ThumbnailGenerationRequest.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  pipelineId: { type: DataTypes.UUID, allowNull: false }, userId: { type: DataTypes.STRING, allowNull: false },
  idempotencyKey: { type: DataTypes.STRING, allowNull: false }, version: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false }, leaseOwner: { type: DataTypes.STRING, allowNull: false },
  leaseExpiresAt: { type: DataTypes.DATE, allowNull: false }, url: { type: DataTypes.STRING, allowNull: true },
  error: { type: DataTypes.TEXT, allowNull: true }, createdAt: DataTypes.DATE, updatedAt: DataTypes.DATE,
}, { sequelize, tableName: "thumbnail_generation_requests", modelName: "ThumbnailGenerationRequest" });
