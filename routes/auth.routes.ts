import { Router } from 'express';
import { signUp, signIn, verifyOTP } from '../controllers/auth.controller';

const router = Router();

router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/verify-otp', verifyOTP);

export default router;