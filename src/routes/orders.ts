import { Router } from 'express';
import { authenticateCustomer } from '../middleware/customerAuthMiddleware.js';
import {
  createOrder,
  getOrders,
  getOrderById,
  getOrderStats,
  cancelOrder,
  updateOrderStatus
} from '../controllers/orderController.js';

const router = Router();

// All routes require customer authentication
router.use(authenticateCustomer);

// Create new order from cart
router.post('/', createOrder);

// Get customer's orders
router.get('/', getOrders);

// Get order statistics (must come before /:orderId to avoid conflict)
router.get('/stats', getOrderStats);

// Get specific order details
router.get('/:orderId', getOrderById);

// Cancel order
router.post('/:orderId/cancel', cancelOrder);

// Update order status (admin only - but route exists)
router.put('/:orderId/status', updateOrderStatus);

export default router;