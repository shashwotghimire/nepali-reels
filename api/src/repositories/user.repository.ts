import User from "../models/users.model";

export const getUser = async (userId: string) => {
  return await User.findByPk(userId);
};
