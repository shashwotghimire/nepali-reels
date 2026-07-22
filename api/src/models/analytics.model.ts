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

// Content Posting API (video.list scope) — own-video metrics only
export interface TikTokVideoInsight {
  video_id: string;
  video_description: string;
  create_time: number;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  duration: number;
}

export class Analytics extends Model<
  InferAttributes<Analytics>,
  InferCreationAttributes<Analytics>
> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<string>;
  declare rawData: TikTokVideoInsight[];
  declare report: CreationOptional<object | null>;
  declare suggestions: CreationOptional<object | null>;
  declare fetchedAt: Date;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Analytics.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.TEXT,
      allowNull: false,
      references: { model: User, key: "id" },
      onDelete: "CASCADE",
    },
    rawData: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    report: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    suggestions: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    fetchedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: "Analytics",
    tableName: "analytics_reports",
  },
);

export default Analytics;
