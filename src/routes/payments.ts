import { Router } from 'express';
import multer from 'multer';
import { authenticateCustomer } from '../middleware/customerAuthMiddleware.js';
import { authenticate, requireAdmin } from '../middleware/authMiddleware.js';
import {
  initiatePayment,
  verifyPayment,
  getPaymentHistory,
  getPaymentById,
  getPaymentStatus,
  verifyPaymentProof,
  processRefund,
  simulatePaymentSuccess,
  simulatePaymentFailure,
  adminVerifyPayment,
  getPaymentForVerification
} from '../controllers/paymentController.js';

// Configure multer for memory storage (database storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

const router = Router();

// Initiate payment for an order (requires customer auth)
router.post('/initiate', authenticateCustomer, initiatePayment);

// Verify payment after gateway response (requires customer auth)
router.post('/verify', authenticateCustomer, verifyPayment);

// Verify payment with proof (screenshot/transaction ID) (requires customer auth)
router.post('/verify-proof', authenticateCustomer, upload.single('paymentProof'), verifyPaymentProof);

// Get payment history (requires customer auth)
router.get('/history', authenticateCustomer, getPaymentHistory);

// Get specific payment details (requires customer auth)
router.get('/:paymentId', authenticateCustomer, getPaymentById);

// Get payment status (simplified for polling) (requires customer auth)
router.get('/:paymentId/status', authenticateCustomer, getPaymentStatus);

// Process refund (requires customer auth)
router.post('/refund', authenticateCustomer, processRefund);

// Simulation routes (for testing) (requires customer auth)
router.post('/simulate/success', authenticateCustomer, simulatePaymentSuccess);
router.post('/simulate/failure', authenticateCustomer, simulatePaymentFailure);

// Admin routes (require admin authentication)
router.get('/admin/verify/:paymentId', authenticate, requireAdmin, getPaymentForVerification);
router.post('/admin/verify', authenticate, requireAdmin, adminVerifyPayment);

export default router;