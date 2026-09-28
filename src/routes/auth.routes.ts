import express from "express";
import {
  adminSignin,
  adminSignup,
  resendVerificationEmail,
  verifyEmail,
} from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/admin/signup", adminSignup);
router.post("/admin/resend-verification", resendVerificationEmail);
router.post("/admin/resend-code", resendVerificationEmail);
router.get("/admin/verify", verifyEmail);
router.get("/admin/verify-email", verifyEmail);
router.post("/admin/verify", verifyEmail);
router.post("/admin/verify-email", verifyEmail);
router.post("/admin/signin", adminSignin);

export default router;