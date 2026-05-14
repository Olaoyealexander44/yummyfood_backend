import { Router } from 'express';
import { signUp, signIn, verifyOTP, resendOTP, forgotPassword, resetPassword, getUserCount } from '../controllers/auth.controller';
import { authenticate, isAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

router.get('/users/count', authenticate, isAdmin, getUserCount);

export default router;