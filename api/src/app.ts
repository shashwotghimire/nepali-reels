import express from "express";
import cors from "cors";
import { auth } from "./lib/auth";
import { toNodeHandler } from "better-auth/node";

const app = express();

app.use(cors({ origin: process.env.FRONTEND_ORIGIN_LOCAL, credentials: true }));
app.use(express.json());

app.all("/api/auth/*path", toNodeHandler(auth));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

export default app;
