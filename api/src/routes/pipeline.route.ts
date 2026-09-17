import { Router } from "express";
import { abandonUncertainOperation, approveScript, editScript, generateScript, getEntitlements, getReels, getPipelineById, getPipelineAudio, getPipelineVideo, deletePipeline, regenerateThumbnail, retryPipeline, reviseScript, selectThumbnail } from "../controllers/pipeline.controller";
import { validate } from "../middlewares/validation.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import { approveScriptSchema, editScriptSchema, generateScriptSchema, getReelsSchema, getPipelineByIdSchema, reviseScriptSchema } from "../validations/pipeline.validation";
import { createChannelStyle, deleteChannelStyle, getChannelStyles } from "../controllers/channel-style.controller";
import { upload } from "../middlewares/multer.middleware";

const router = Router();
router.get("/", authMiddleware, validate(getReelsSchema), getReels);
router.get("/entitlements", authMiddleware, getEntitlements);
router.get("/styles", authMiddleware, getChannelStyles);
router.post("/styles", authMiddleware, upload.single("logo"), createChannelStyle);
router.delete("/styles/:id", authMiddleware, deleteChannelStyle);
router.get("/:id", authMiddleware, validate(getPipelineByIdSchema), getPipelineById);
router.get("/:id/audio", authMiddleware, validate(getPipelineByIdSchema), getPipelineAudio);
router.get("/:id/video", authMiddleware, validate(getPipelineByIdSchema), getPipelineVideo);
router.delete("/:id", authMiddleware, validate(getPipelineByIdSchema), deletePipeline);
router.post("/:id/retry", authMiddleware, validate(getPipelineByIdSchema), retryPipeline);
router.patch("/:id/script", authMiddleware, validate(editScriptSchema), editScript);
router.post("/:id/script/revise", authMiddleware, validate(reviseScriptSchema), reviseScript);
router.post("/:id/script/approve", authMiddleware, validate(approveScriptSchema), approveScript);
router.post("/:id/thumbnails/regenerate", authMiddleware, regenerateThumbnail);
router.post("/:id/thumbnails/:version/select", authMiddleware, selectThumbnail);
router.post("/:id/operations/:kind/:key/abandon", authMiddleware, abandonUncertainOperation);
router.post("/generate-script", authMiddleware, validate(generateScriptSchema), generateScript);

export default router;
