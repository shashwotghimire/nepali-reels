import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { getUser } from "../controllers/user.controller";

const router = Router();

router.get("/me", authMiddleware, getUser);

export default router;
