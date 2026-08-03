import { Router } from "express";
import { generateScript, getReels, getPipelineById, getPipelineAudio, getPipelineVideo, deletePipeline, retryPipeline } from "../controllers/pipeline.controller";
import { validate } from "../middlewares/validation.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import { generateScriptSchema, getReelsSchema, getPipelineByIdSchema } from "../validations/pipeline.validation";

const router = Router();
router.get("/", authMiddleware, validate(getReelsSchema), getReels);
router.get("/:id", authMiddleware, validate(getPipelineByIdSchema), getPipelineById);
router.get("/:id/audio", authMiddleware, validate(getPipelineByIdSchema), getPipelineAudio);
router.get("/:id/video", authMiddleware, validate(getPipelineByIdSchema), getPipelineVideo);
router.delete("/:id", authMiddleware, validate(getPipelineByIdSchema), deletePipeline);
router.post("/:id/retry", authMiddleware, validate(getPipelineByIdSchema), retryPipeline);
router.post("/generate-script", authMiddleware, validate(generateScriptSchema), generateScript);

export default router;
