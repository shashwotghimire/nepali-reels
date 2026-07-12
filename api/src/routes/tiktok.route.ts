import { Router } from "express";
import {
  connectTiktok,
  tiktokCallback,
  getTiktokStatus,
  disconnectTiktok,
} from "../controllers/tiktok.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.get("/connect", authMiddleware, connectTiktok);
router.get("/callback", authMiddleware, tiktokCallback);
router.get("/status", authMiddleware, getTiktokStatus);
router.delete("/disconnect", authMiddleware, disconnectTiktok);

export default router;
