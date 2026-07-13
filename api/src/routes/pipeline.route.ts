import { Router } from "express";
import { generateScript } from "../controllers/pipeline.controller";
import { validate } from "../middlewares/validation.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import { generateScriptSchema } from "../validations/pipeline.validation";

const router = Router();
router.post("/generate-script", authMiddleware, validate(generateScriptSchema), generateScript);

export default router;
