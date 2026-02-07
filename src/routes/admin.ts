import { Router } from 'express';
import {
  getDashboardStats,
  getAllUsers,
  getUserById,
  updateUserRole,
  deleteUser,
  getRecentActivity,
  getSystemInfo,
  getAllOrders,
  getOrderStats,
  updateOrderStatus
} from '../controllers/adminController';
import {
  getAllPaymentVerifications,
  getPaymentVerificationById,
  approvePaymentVerification,
  rejectPaymentVerification,
  getPaymentVerificationStats
} from '../controllers/adminPaymentVerificationController';
import { authenticate, requireAdmin } from '../middleware/authMiddleware';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate, requireAdmin);

// Dashboard
router.get('/dashboard/stats', getDashboardStats);
router.get('/dashboard/activity', getRecentActivity);

// User Management
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);

// Order Management
router.get('/orders', getAllOrders);
router.get('/orders/stats', getOrderStats);
router.put('/orders/:orderId/status', updateOrderStatus);

// Payment Verification Management
router.get('/payment-verifications', getAllPaymentVerifications);
router.get('/payment-verifications/stats', getPaymentVerificationStats);
router.get('/payment-verifications/:verificationId', getPaymentVerificationById);
router.post('/payment-verifications/:verificationId/approve', approvePaymentVerification);
router.post('/payment-verifications/:verificationId/reject', rejectPaymentVerification);

// System
router.get('/system', getSystemInfo);

export default router;