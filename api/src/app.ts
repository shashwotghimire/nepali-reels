import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { auth } from "./lib/auth";
import { toNodeHandler } from "better-auth/node";
import { errorHandler } from "./middlewares/error.middleware";
import tiktokRouter from "./routes/tiktok.route";
import userRoute from "./routes/user.route";

const app = express();

app.set("trust proxy", 1);

app.use(
  cors({
    origin: [
      process.env.FRONTEND_ORIGIN_LOCAL!,
      process.env.FRONTEND_ORIGIN_PROD!,
    ],
    credentials: true,
  }),
);
app.use(cookieParser(process.env.COOKIE_SECRET!));
app.use(express.json());

app.all("/api/auth/*splat", toNodeHandler(auth));
app.use("/api/users", userRoute);
app.use("/api/tiktok", tiktokRouter);

app.use(errorHandler);
export default app;
