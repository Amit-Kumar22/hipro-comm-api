import { Router } from 'express';
import { authenticateCustomer } from '../middleware/customerAuthMiddleware.js';
import {
  processPayment,
  getPaymentHistory,
  getPaymentById,
  requestRefund,
  getPaymentStats
} from '../controllers/paymentController.js';

const router = Router();

// All routes require customer authentication
router.use(authenticateCustomer);

// Process payment
router.post('/process', processPayment);

// Get payment history
router.get('/', getPaymentHistory);

// Get payment statistics
router.get('/stats', getPaymentStats);

// Get specific payment
router.get('/:paymentId', getPaymentById);

// Request refund
router.post('/:paymentId/refund', requestRefund);

export default router;