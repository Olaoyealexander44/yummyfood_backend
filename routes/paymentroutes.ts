import { Router } from 'express';
import multer from 'multer';
import { submitPayment, getAllPayments } from '../controllers/paymentcontroller';
import { authenticate, isAdmin, tryAuthenticate } from '../middlewares/auth.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/payments/submit
// Use 'tryAuthenticate' to capture user ID if logged in, but still allow guests
router.post('/submit', tryAuthenticate, upload.single('receipt'), submitPayment);

// GET /api/payments/all (Admin only)
router.get('/all', authenticate, isAdmin, getAllPayments);

export default router;