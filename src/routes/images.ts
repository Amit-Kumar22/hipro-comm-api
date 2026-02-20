import express from 'express';
import { authenticate, requireAdmin } from '../middleware/authMiddleware.js';
import {
  imageUpload,
  getImage,
  getImageMetadata,
  uploadImage,
  uploadImages,
  deleteImage,
  deleteImagesByEntity,
  getImagesByEntity,
  updateImageMetadata
} from '../controllers/imageController.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/images/{id}:
 *   get:
 *     summary: Get image by ID (returns actual image data)
 *     tags: [Images]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Image ID
 *     responses:
 *       200:
 *         description: Image data
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Image not found
 */
router.get('/:id', getImage);

/**
 * @swagger
 * /api/v1/images/{id}/metadata:
 *   get:
 *     summary: Get image metadata by ID
 *     tags: [Images]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Image ID
 *     responses:
 *       200:
 *         description: Image metadata
 *       404:
 *         description: Image not found
 */
router.get('/:id/metadata', getImageMetadata);

/**
 * @swagger
 * /api/v1/images/entity/{entityType}/{entityId}:
 *   get:
 *     summary: Get all images for an entity
 *     tags: [Images]
 *     parameters:
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [product, category, payment, other]
 *         description: Entity type
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema:
 *           type: string
 *         description: Entity ID
 *     responses:
 *       200:
 *         description: List of images
 */
router.get('/entity/:entityType/:entityId', getImagesByEntity);

/**
 * @swagger
 * /api/v1/images/upload:
 *   post:
 *     summary: Upload a single image (Admin only)
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               alt:
 *                 type: string
 *               entityType:
 *                 type: string
 *                 enum: [product, category, payment, other]
 *               entityId:
 *                 type: string
 *               isPrimary:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Image uploaded successfully
 *       400:
 *         description: Validation error
 */
router.post('/upload', authenticate, requireAdmin, imageUpload.single('image'), uploadImage);

/**
 * @swagger
 * /api/v1/images/upload-multiple:
 *   post:
 *     summary: Upload multiple images (Admin only)
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               alts:
 *                 type: string
 *                 description: JSON array or comma-separated alt texts
 *               entityType:
 *                 type: string
 *                 enum: [product, category, payment, other]
 *               entityId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Images uploaded successfully
 *       400:
 *         description: Validation error
 */
router.post('/upload-multiple', authenticate, requireAdmin, imageUpload.array('images', 10), uploadImages);

/**
 * @swagger
 * /api/v1/images/{id}:
 *   patch:
 *     summary: Update image metadata (Admin only)
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Image ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               alt:
 *                 type: string
 *               isPrimary:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Image metadata updated successfully
 *       404:
 *         description: Image not found
 */
router.patch('/:id', authenticate, requireAdmin, updateImageMetadata);

/**
 * @swagger
 * /api/v1/images/{id}:
 *   delete:
 *     summary: Delete image by ID (Admin only)
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Image ID
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *       404:
 *         description: Image not found
 */
router.delete('/:id', authenticate, requireAdmin, deleteImage);

/**
 * @swagger
 * /api/v1/images/entity/{entityType}/{entityId}:
 *   delete:
 *     summary: Delete all images for an entity (Admin only)
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [product, category, payment, other]
 *         description: Entity type
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema:
 *           type: string
 *         description: Entity ID
 *     responses:
 *       200:
 *         description: Images deleted successfully
 */
router.delete('/entity/:entityType/:entityId', authenticate, requireAdmin, deleteImagesByEntity);

export default router;
