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
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "TiktokConnection",
    tableName: "tiktok_connection",
  },
);

export default TiktokConnection;
