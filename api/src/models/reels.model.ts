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

type PipelineStatus =
  | "queued"
  | "script_generated"
  | "script_finalised"
  | "video_spec_generated"
  | "sound_generated"
  | "failed";

export class Reels extends Model<
  InferAttributes<Reels>,
  InferCreationAttributes<Reels>
> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<string>;
  declare topic: string;
  declare draftScript: CreationOptional<object | null>;
  declare finalScript: CreationOptional<object | null>;
  declare videoSpec: CreationOptional<object | null>;
  declare soundSpec: CreationOptional<object | null>;
  declare pipelineStatus: PipelineStatus;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Reels.init(
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
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    topic: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    draftScript: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    finalScript: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    videoSpec: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    soundSpec: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    pipelineStatus: {
      type: DataTypes.ENUM(
        "queued",
        "script_generated",
        "script_finalised",
        "video_spec_generated",
        "sound_generated",
        "failed",
      ),
      allowNull: false,
      defaultValue: "queued",
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: "Reels",
    tableName: "reels",
  },
);

export default Reels;
