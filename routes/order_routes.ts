import { Router } from 'express';
import { createOrder, getUserOrders } from '../controllers/order.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Both routes require the user to be signed in
router.post('/', authenticate, createOrder);
router.get('/history', authenticate, getUserOrders);

export default router;