import User from "./users.model";
import TiktokConnection from "./tiktok-connection.model";

User.hasOne(TiktokConnection, { foreignKey: "userId" });
TiktokConnection.belongsTo(User, { foreignKey: "userId" });
