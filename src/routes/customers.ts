import express from 'express';
import {
  sendOTP,
  registerCustomer,
  loginCustomer,
  verifyOTP,
  resendOTP,
  logoutCustomer,
  getCurrentCustomer,
  changePassword
} from '../controllers/customerAuthController';
import { authenticateCustomer } from '../middleware/customerAuthMiddleware';

const router = express.Router();

// Public routes (no authentication required)
router.post('/send-otp', sendOTP);
router.post('/register', registerCustomer);
router.post('/login', loginCustomer);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);

// Protected routes (authentication required)
router.use(authenticateCustomer); // Apply authentication middleware to all routes below

router.post('/logout', logoutCustomer);
router.get('/profile', getCurrentCustomer);
router.patch('/change-password', changePassword);

export default router;