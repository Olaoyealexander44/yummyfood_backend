import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import paymentRoutes from './routes/paymentroutes';
import orderRoutes from './routes/order.routes';
import contactRoutes from './routes/contact.routes';

const app = express();

// Update CORS to allow requests from local and Vercel frontend
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://yummyfood-frontend.vercel.app'
  ],
  credentials: true
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/contact', contactRoutes);

export default app;

