import { Router } from 'express';
import {
  getAllPaymentVerifications,
  getPaymentVerificationById,
  approvePaymentVerification,
  rejectPaymentVerification,
  getPaymentVerificationStats
} from '../controllers/adminPaymentVerificationController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// GET /api/v1/admin/payment-verifications - Get all payment verifications
router.get(
  '/payment-verifications',
  authenticate,
  getAllPaymentVerifications
);

// GET /api/v1/admin/payment-verifications/stats - Get verification statistics
router.get(
  '/payment-verifications/stats',
  authenticate,
  getPaymentVerificationStats
);

// GET /api/v1/admin/payment-verifications/:verificationId - Get specific verification
router.get(
  '/payment-verifications/:verificationId',
  authenticate,
  getPaymentVerificationById
);

// POST /api/v1/admin/payment-verifications/:verificationId/approve - Approve verification
router.post(
  '/payment-verifications/:verificationId/approve',
  authenticate,
  approvePaymentVerification
);

// POST /api/v1/admin/payment-verifications/:verificationId/reject - Reject verification
router.post(
  '/payment-verifications/:verificationId/reject',
  authenticate,
  rejectPaymentVerification
);

export default router;