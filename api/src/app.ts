import express from "express";
import cors from "cors";
import { auth } from "./lib/auth";
import { toNodeHandler } from "better-auth/node";

const app = express();

app.set("trust proxy", 1);

app.use(
  cors({
    origin: [
      process.env.FRONTEND_ORIGIN_LOCAL!,
      process.env.FRONTEND_ORIGIN_PROD!,
    ],
    credentials: true,
  })
);
app.use(express.json());

app.all("/api/auth/*path", toNodeHandler(auth));

export default app;
