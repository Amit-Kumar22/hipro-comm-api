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
  (req, res, next) => {
    console.log('🔄 Payment verification route accessed');
    console.log('Request headers:', {
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      userAgent: req.headers['user-agent']
    });
    next();
  },
  optionalCustomerAuth,
  (req, res, next) => {
    const customerReq = req as any;
    console.log('🔐 Auth middleware passed, user:', customerReq.customer?.email || 'anonymous');
    next();
  },
  uploadPaymentProof,
  (req, res, next) => {
    const fileReq = req as any;
    console.log('📁 File upload middleware passed, file:', fileReq.file ? fileReq.file.filename : 'no file');
    next();
  },
  verifyPayment
);

// GET /api/payment/verification/:orderId - Get payment verification status
router.get(
  '/verification/:orderId',
  authenticateCustomer,
  getPaymentVerificationStatus
);

export default router;