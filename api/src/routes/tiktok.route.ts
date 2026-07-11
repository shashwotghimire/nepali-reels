import { Router } from "express";
import {
  connectTiktok,
  tiktokCallback,
} from "../controllers/tiktok.controller";

const router = Router();

router.get("/connect", connectTiktok);
router.get("/callback", tiktokCallback);

export default router;
