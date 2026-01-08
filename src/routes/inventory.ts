import { Router } from 'express';
import {
  getInventory,
  getInventoryItem,
  updateInventory,
  adjustStock,
  getLowStockItems,
  getInventoryStats,
  bulkUpdateInventory
} from '../controllers/inventoryController';
import { authenticate, requireAdmin } from '../middleware/authMiddleware';

const router = Router();

// Public routes (if needed for customer-facing stock checks)
// router.get('/check/:productId', getProductStock);

// Protected routes (Admin only)
router.use(authenticate);
router.use(requireAdmin);

router.get('/', getInventory);
router.get('/stats', getInventoryStats);
router.get('/low-stock', getLowStockItems);
router.get('/:id', getInventoryItem);
router.put('/:id', updateInventory);
router.post('/:id/adjust', adjustStock);
router.post('/bulk-update', bulkUpdateInventory);

export default router;