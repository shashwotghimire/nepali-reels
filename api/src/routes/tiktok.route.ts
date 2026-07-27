import { Router } from "express";
import {
  connectTiktok,
  tiktokCallback,
  getTiktokStatus,
  disconnectTiktok,
  getCreatorInfo,
  publishVideo,
} from "../controllers/tiktok.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import { publishVideoSchema } from "../validations/tiktok.validation";

const router = Router();

router.get("/connect", authMiddleware, connectTiktok);
router.get("/callback", authMiddleware, tiktokCallback);
router.get("/status", authMiddleware, getTiktokStatus);
router.delete("/disconnect", authMiddleware, disconnectTiktok);
router.post("/creator-info", authMiddleware, getCreatorInfo);
router.post("/publish", authMiddleware, validate(publishVideoSchema), publishVideo);

export default router;
