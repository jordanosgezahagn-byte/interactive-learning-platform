import { Router } from 'express';
import {
  getCurrentUser,
  login,
  logout,
  register,
  resendVerification,
  verifyEmail,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.post('/register', register);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', requireAuth, getCurrentUser);

export default router;
