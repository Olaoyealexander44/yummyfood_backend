import { Router } from 'express';
import { signUp, signIn, verifyOTP, resendOTP, forgotPassword, resetPassword } from '../controllers/auth.controller';

const router = Router();

router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;