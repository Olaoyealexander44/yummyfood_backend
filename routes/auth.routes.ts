import { Router } from 'express';
import { signUp, signIn, verifyOTP, resendOTP } from '../controllers/auth.controller';

const router = Router();

router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);

export default router;