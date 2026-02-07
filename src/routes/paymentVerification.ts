import { Router } from 'express';
import { 
  verifyPayment, 
  getPaymentVerificationStatus,
  uploadPaymentProof 
} from '../controllers/paymentVerificationController';
import { authenticateCustomer } from '../middleware/customerAuthMiddleware';
import { optionalCustomerAuth } from '../middleware/optionalCustomerAuth';

const router = Router();

// Debug endpoint to test authentication
router.get('/debug-auth', optionalCustomerAuth, (req: any, res) => {
  res.json({
    isAuthenticated: req.isAuthenticated,
    customerId: req.customer?.id,
    customerEmail: req.customer?.email,
    cookies: req.cookies,
    authHeader: req.headers.authorization
  });
});

// POST /api/payment/verify - Upload payment screenshot and verify payment
// Using optional auth so payment verification works even if session expires
router.post(
  '/verify',
  optionalCustomerAuth,
  uploadPaymentProof,
  verifyPayment
);

// GET /api/payment/verification/:orderId - Get payment verification status
router.get(
  '/verification/:orderId',
  authenticateCustomer,
  getPaymentVerificationStatus
);

export default router;