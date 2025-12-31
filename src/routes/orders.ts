import { Router } from 'express';
import { authenticateCustomer } from '../middleware/customerAuthMiddleware.js';
import {
  placeOrder,
  getOrders,
  getOrderById,
  cancelOrder,
  getOrderStats
} from '../controllers/orderController.js';

const router = Router();

// All routes require customer authentication
router.use(authenticateCustomer);

// Place new order
router.post('/', placeOrder);

// Get customer's orders
router.get('/', getOrders);

// Get order statistics
router.get('/stats', getOrderStats);

// Get specific order
router.get('/:orderId', getOrderById);

// Cancel order
router.patch('/:orderId/cancel', cancelOrder);

export default router;