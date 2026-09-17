import ChannelStyle from "../models/channel-style.model";
import User from "../models/users.model";
import sequelize from "../configs/db.config";

export const listChannelStyles = (userId: string) => ChannelStyle.findAll({ where: { userId }, order: [["createdAt", "ASC"]] });
export const findChannelStyle = (userId: string, id: string) => ChannelStyle.findOne({ where: { id, userId } });
export const countChannelStyles = (userId: string) => ChannelStyle.count({ where: { userId } });
export const createChannelStyle = (input: { userId: string; name: string; channelName: string; logoUrl?: string | null; captionPreset: "default" | "bold" | "minimal" }) => ChannelStyle.create(input);
export async function reserveChannelStyleSlot(input: { id: string; userId: string; name: string; channelName: string; captionPreset: "default" | "bold" | "minimal"; limit: number }) {
  return sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(input.userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) throw new Error("User not found");
    const count = await ChannelStyle.count({ where: { userId: input.userId }, transaction });
    if (count >= input.limit) throw new Error("Saved style limit reached");
    return ChannelStyle.create({ id: input.id, userId: input.userId, name: input.name, channelName: input.channelName, captionPreset: input.captionPreset, logoUrl: null }, { transaction });
  });
}
export async function setChannelStyleLogo(userId: string, id: string, logoUrl: string) {
  const style = await findChannelStyle(userId, id); if (!style) throw new Error("Style not found"); style.logoUrl = logoUrl; await style.save(); return style;
}
export async function deleteChannelStyle(userId: string, id: string) {
  const style = await findChannelStyle(userId, id);
  if (!style) return false;
  await style.destroy();
  return true;
}
