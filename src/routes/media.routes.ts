import { Router } from "express";
import {
  createMedia,
  deleteMedia,
  getAllMedia,
  getMediaById,
  updateMedia,
} from "../controllers/media.controller.js";
import { requireAdminAuth } from "../middlewares/auth.middleware.js";

const router = Router();

// --- Public read endpoints (gallery visible to everyone) ------------
router.get("/", getAllMedia);
router.get("/:id", getMediaById);

// --- Protected mutations (require a signed-in admin) ---------------
router.post("/", requireAdminAuth, createMedia);
router.put("/:id", requireAdminAuth, updateMedia);
router.delete("/:id", requireAdminAuth, deleteMedia);

export default router;