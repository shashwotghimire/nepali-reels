import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import sequelize from "../configs/db.config";

export default class ChannelStyle extends Model<InferAttributes<ChannelStyle>, InferCreationAttributes<ChannelStyle>> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare name: string;
  declare channelName: string;
  declare logoUrl: CreationOptional<string | null>;
  declare captionPreset: "default" | "bold" | "minimal";
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

ChannelStyle.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  channelName: { type: DataTypes.STRING, allowNull: false },
  logoUrl: { type: DataTypes.STRING, allowNull: true },
  captionPreset: { type: DataTypes.STRING, allowNull: false, defaultValue: "default" },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE,
}, { sequelize, tableName: "channel_styles", modelName: "ChannelStyle" });
