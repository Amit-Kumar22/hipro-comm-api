import { Request, Response } from 'express';
import { Image } from '../models';
import { 
  asyncHandler, 
  NotFoundError,
  ValidationError
} from '../middleware/errorMiddleware';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import multer from 'multer';

// Configure multer for memory storage (store in buffer for database)
const storage = multer.memoryStorage();

export const imageUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP, SVG) are allowed') as any, false);
    }
  }
});

// Helper function to generate image URL
export const generateImageUrl = (imageId: string): string => {
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://shop.hiprotech.org' 
    : (process.env.API_BASE_URL || 'http://localhost:5001');
  return `${baseUrl}/api/v1/images/${imageId}`;
};

/**
 * Get image by ID - serves the actual image data
 */
export const getImage = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const image = await Image.findById(id);
  
  if (!image) {
    throw new NotFoundError('Image not found');
  }

  // Set cache headers for images (cache for 1 year since images are immutable)
  res.set({
    'Content-Type': image.contentType,
    'Content-Length': image.size,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'ETag': `"${image._id}"`,
  });

  // Check for ETag match
  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch === `"${image._id}"`) {
    res.status(304).end();
    return;
  }

  res.send(image.data);
});

/**
 * Get image metadata by ID
 */
export const getImageMetadata = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const image = await Image.findById(id).select('-data');
  
  if (!image) {
    throw new NotFoundError('Image not found');
  }

  res.json({
    success: true,
    data: {
      id: image._id,
      name: image.name,
      alt: image.alt,
      contentType: image.contentType,
      size: image.size,
      width: image.width,
      height: image.height,
      entityType: image.entityType,
      entityId: image.entityId,
      isPrimary: image.isPrimary,
      url: generateImageUrl(image._id.toString()),
      createdAt: image.createdAt,
      updatedAt: image.updatedAt
    }
  });
});

/**
 * Upload single image to database
 */
export const uploadImage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.file) {
    throw new ValidationError('No image file provided');
  }

  const { alt, entityType, entityId, isPrimary } = req.body;

  if (!alt) {
    throw new ValidationError('Alt text is required');
  }

  // Validate entityType if provided
  const validEntityTypes = ['product', 'category', 'payment', 'other'];
  if (entityType && !validEntityTypes.includes(entityType)) {
    throw new ValidationError('Invalid entity type');
  }

  // Create image record in database
  const image = await Image.create({
    name: req.file.originalname,
    alt: alt,
    data: req.file.buffer,
    contentType: req.file.mimetype,
    size: req.file.size,
    entityType: entityType || 'other',
    entityId: entityId || null,
    isPrimary: isPrimary === 'true' || isPrimary === true
  });

  res.status(201).json({
    success: true,
    message: 'Image uploaded successfully',
    data: {
      id: image._id,
      name: image.name,
      alt: image.alt,
      contentType: image.contentType,
      size: image.size,
      entityType: image.entityType,
      entityId: image.entityId,
      isPrimary: image.isPrimary,
      url: generateImageUrl(image._id.toString()),
      createdAt: image.createdAt
    }
  });
});

/**
 * Upload multiple images to database
 */
export const uploadImages = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const files = req.files as Express.Multer.File[];
  
  if (!files || files.length === 0) {
    throw new ValidationError('No image files provided');
  }

  const { entityType, entityId, alts } = req.body;
  
  // Parse alts - can be a JSON array or comma-separated string
  let altTexts: string[] = [];
  if (typeof alts === 'string') {
    try {
      altTexts = JSON.parse(alts);
    } catch {
      altTexts = alts.split(',').map((a: string) => a.trim());
    }
  } else if (Array.isArray(alts)) {
    altTexts = alts;
  }

  // Validate entityType if provided
  const validEntityTypes = ['product', 'category', 'payment', 'other'];
  if (entityType && !validEntityTypes.includes(entityType)) {
    throw new ValidationError('Invalid entity type');
  }

  const uploadedImages = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;
    const alt = altTexts[i] || file.originalname;
    
    const image = await Image.create({
      name: file.originalname,
      alt: alt,
      data: file.buffer,
      contentType: file.mimetype,
      size: file.size,
      entityType: entityType || 'other',
      entityId: entityId || null,
      isPrimary: i === 0 // First image is primary by default
    });

    uploadedImages.push({
      id: image._id,
      name: image.name,
      alt: image.alt,
      contentType: image.contentType,
      size: image.size,
      entityType: image.entityType,
      entityId: image.entityId,
      isPrimary: image.isPrimary,
      url: generateImageUrl(image._id.toString())
    });
  }

  res.status(201).json({
    success: true,
    message: `${uploadedImages.length} images uploaded successfully`,
    data: uploadedImages
  });
});

/**
 * Delete image by ID
 */
export const deleteImage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const image = await Image.findById(id);
  
  if (!image) {
    throw new NotFoundError('Image not found');
  }

  await Image.findByIdAndDelete(id);

  res.json({
    success: true,
    message: 'Image deleted successfully'
  });
});

/**
 * Delete images by entity (for when product/category is deleted)
 */
export const deleteImagesByEntity = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { entityType, entityId } = req.params;

  const validEntityTypes = ['product', 'category', 'payment', 'other'];
  if (!entityType || !validEntityTypes.includes(entityType)) {
    throw new ValidationError('Invalid entity type');
  }

  const result = await Image.deleteMany({ entityType, entityId });

  res.json({
    success: true,
    message: `${result.deletedCount} images deleted successfully`
  });
});

/**
 * Get images by entity
 */
export const getImagesByEntity = asyncHandler(async (req: Request, res: Response) => {
  const { entityType, entityId } = req.params;

  const validEntityTypes = ['product', 'category', 'payment', 'other'];
  if (!entityType || !validEntityTypes.includes(entityType)) {
    throw new ValidationError('Invalid entity type');
  }

  const images = await Image.find({ entityType, entityId })
    .select('-data')
    .sort({ isPrimary: -1, createdAt: 1 });

  const imagesWithUrls = images.map(image => ({
    id: image._id,
    name: image.name,
    alt: image.alt,
    contentType: image.contentType,
    size: image.size,
    entityType: image.entityType,
    entityId: image.entityId,
    isPrimary: image.isPrimary,
    url: generateImageUrl(image._id.toString()),
    createdAt: image.createdAt
  }));

  res.json({
    success: true,
    data: imagesWithUrls
  });
});

/**
 * Update image metadata (alt text, isPrimary)
 */
export const updateImageMetadata = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { alt, isPrimary } = req.body;

  const image = await Image.findById(id);
  
  if (!image) {
    throw new NotFoundError('Image not found');
  }

  // Update fields
  if (alt !== undefined) {
    image.alt = alt;
  }
  
  if (isPrimary !== undefined) {
    // If setting as primary, unset other primary images for same entity
    if (isPrimary && image.entityId) {
      await Image.updateMany(
        { entityType: image.entityType, entityId: image.entityId, _id: { $ne: id } },
        { isPrimary: false }
      );
    }
    image.isPrimary = isPrimary;
  }

  await image.save();

  res.json({
    success: true,
    message: 'Image metadata updated successfully',
    data: {
      id: image._id,
      name: image.name,
      alt: image.alt,
      contentType: image.contentType,
      size: image.size,
      entityType: image.entityType,
      entityId: image.entityId,
      isPrimary: image.isPrimary,
      url: generateImageUrl(image._id.toString())
    }
  });
});
