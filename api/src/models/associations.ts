import User from "./users.model";
import TiktokConnection from "./tiktok-connection.model";
import Reels from "./reels.model";
import Analytics from "./analytics.model";

User.hasOne(TiktokConnection, { foreignKey: "userId" });
TiktokConnection.belongsTo(User, { foreignKey: "userId" });

User.hasMany(Reels, { foreignKey: "userId" });
Reels.belongsTo(User, { foreignKey: "userId" });

User.hasMany(Analytics, { foreignKey: "userId" });
Analytics.belongsTo(User, { foreignKey: "userId" });
