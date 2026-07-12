import TiktokConnection from "../models/tiktok-connection.model";

export const createTiktokConnection = async (data: {
  userId: string;
  tiktokUserId: string;
  tiktokAccessToken: string;
  tiktokRefreshToken: string;
  tiktokExpiresAt: number;
  tiktokRefreshExpiresAt: number;
  displayName?: string;
  avatarUrl?: string;
  username?: string;
}) => {
  return TiktokConnection.upsert(data, { conflictFields: ["userId"] });
};

export const getUserTiktokConnectionDetails = async (data: {
  userId: string;
}) => {
  return TiktokConnection.findOne({
    where: {
      userId: data.userId,
    },
  });
};

export const deleteTiktokConnection = async (userId: string) => {
  return TiktokConnection.destroy({ where: { userId } });
};

export const getUserTiktokAccessToken = async (userId: string) => {
  return TiktokConnection.findOne({
    where: { userId },
    attributes: ["tiktokAccessToken"],
  });
};
