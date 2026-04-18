import { Router } from 'express';
import { sendContactEmail } from '../controllers/contact.controller';

const router = Router();

// Route to handle contact form submissions
router.post('/send', sendContactEmail);

export default router;