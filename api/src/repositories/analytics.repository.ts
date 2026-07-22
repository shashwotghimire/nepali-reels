import Analytics from "../models/analytics.model";

export const findLatestAnalyticsByUser = (userId: string) => {
  return Analytics.findOne({
    where: { userId },
    order: [["fetchedAt", "DESC"]],
  });
};

export const findAllAnalyticsByUser = (userId: string) => {
  return Analytics.findAll({
    where: { userId },
    order: [["fetchedAt", "DESC"]],
  });
};
