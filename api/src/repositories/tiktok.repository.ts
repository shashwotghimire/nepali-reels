import TiktokConnection from "../models/tiktok-connection.model";

export const createTiktokConnection = async (data: {
  userId: string;
  tiktokUserId: string;
  tiktokAccessToken: string;
  tiktokRefreshToken: string;
  tiktokExpiresAt: number;
}) => {
  return TiktokConnection.create(data);
};
