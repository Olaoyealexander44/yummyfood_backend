import { Router } from 'express';
import { createOrder, getUserOrders, getAllOrders, updateOrderStatus } from '../controllers/order.controller';
import { authenticate, isAdmin } from '../middlewares/auth.middleware';

const router = Router();

// All order routes require authentication
router.use(authenticate);

router.post('/create', createOrder);
router.get('/history', getUserOrders);
router.get('/all', authenticate, isAdmin, getAllOrders);
router.patch('/status/:id', authenticate, isAdmin, updateOrderStatus);

export default router;