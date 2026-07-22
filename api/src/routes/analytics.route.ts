import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { getLatestAnalytics, getAllAnalytics } from "../controllers/analytics.controller";

const router = Router();

router.get("/latest", authMiddleware, getLatestAnalytics);
router.get("/history", authMiddleware, getAllAnalytics);

export default router;
