import "dotenv/config";
import app from "./app";
import { authenticateDB } from "./configs/db.config";

const PORT = process.env.PORT || 3000;

authenticateDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
