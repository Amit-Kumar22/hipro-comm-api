import { Router } from 'express';
import { 
  verifyPayment, 
  getPaymentVerificationStatus,
  uploadPaymentProof 
} from '../controllers/paymentVerificationController';
import PaymentVerification from '../models/PaymentVerification';
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

// GET /api/payment/screenshot/:verificationId - Get payment screenshot
router.get(
  '/screenshot/:verificationId',
  authenticateCustomer,
  async (req, res): Promise<void> => {
    try {
      const { verificationId } = req.params;
      const verification = await PaymentVerification.findById(verificationId);
      
      if (!verification || !verification.screenshot) {
        res.status(404).json({ success: false, message: 'Screenshot not found' });
        return;
      }

      res.set({
        'Content-Type': verification.screenshot.contentType,
        'Content-Length': verification.screenshot.size.toString(),
        'Cache-Control': 'private, max-age=3600',
      });

      res.send(verification.screenshot.data);
    } catch (error: any) {
      res.status(500).json({ success: false, message: 'Failed to retrieve screenshot' });
    }
  }
);

export default router;