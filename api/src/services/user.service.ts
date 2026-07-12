import { getUser } from "../repositories/user.repository";

export const getUserProfileService = async (userId: string) => {
  return await getUser(userId);
};
