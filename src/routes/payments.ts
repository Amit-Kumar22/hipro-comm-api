import { Router } from 'express';
import { authenticateCustomer } from '../middleware/customerAuthMiddleware.js';
import {
  initiatePayment,
  verifyPayment,
  getPaymentHistory,
  getPaymentById,
  processRefund,
  simulatePaymentSuccess,
  simulatePaymentFailure
} from '../controllers/paymentController.js';

const router = Router();

// All routes require customer authentication
router.use(authenticateCustomer);

// Initiate payment for an order
router.post('/initiate', initiatePayment);

// Verify payment after gateway response
router.post('/verify', verifyPayment);

// Get payment history
router.get('/history', getPaymentHistory);

// Get specific payment details
router.get('/:paymentId', getPaymentById);

// Process refund
router.post('/refund', processRefund);

// Simulation routes (for testing)
router.post('/simulate/success', simulatePaymentSuccess);
router.post('/simulate/failure', simulatePaymentFailure);

export default router;