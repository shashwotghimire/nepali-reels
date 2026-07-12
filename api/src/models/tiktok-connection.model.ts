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

class TiktokConnection extends Model<
  InferAttributes<TiktokConnection>,
  InferCreationAttributes<TiktokConnection>
> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<string>;
  declare tiktokUserId: string;
  declare tiktokAccessToken: string;
  declare tiktokRefreshToken: string;
  declare tiktokExpiresAt: number;
  declare tiktokRefreshExpiresAt: number;
  declare displayName: CreationOptional<string | null>;
  declare avatarUrl: CreationOptional<string | null>;
  declare username: CreationOptional<string | null>;
}

TiktokConnection.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      references: { model: User, key: "id" },
    },
    tiktokUserId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    tiktokAccessToken: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    tiktokRefreshToken: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    tiktokExpiresAt: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    tiktokRefreshExpiresAt: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    avatarUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "TiktokConnection",
    tableName: "tiktok_connection",
  },
);

export default TiktokConnection;
