import express from 'express';
import multer from 'multer';
import { videoUpload, mediaUpload, generateFileUrl } from '../services/uploadService.js';
import { authenticate, requireAdmin } from '../middleware/authMiddleware.js';
import { analyzeVideoFile } from '../controllers/videoAnalysisController.js';
import { Image, IImage } from '../models/index.js';

const router = express.Router();

// Configure multer for memory storage (database storage)
const memoryStorage = multer.memoryStorage();
const imageUploadToDb = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB for images
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!') as any, false);
    }
  }
});

// Helper function to generate image URL from database ID
const generateImageDbUrl = (imageId: string): string => {
  // Priority: Custom API URL > Environment-specific URL > Default fallback
  let baseUrl: string;
  
  if (process.env.API_BASE_URL) {
    // Use custom API base URL if provided
    baseUrl = process.env.API_BASE_URL;
  } else if (process.env.NODE_ENV === 'production') {
    // Production default
    baseUrl = 'https://shop.hiprotech.org';
  } else {
    // Development fallback
    baseUrl = 'http://localhost:5001';
  }
  
  // Ensure baseUrl doesn't end with slash
  baseUrl = baseUrl.replace(/\/$/, '');
  
  return `${baseUrl}/api/v1/images/${imageId}`;
};

// Upload single image to database
router.post('/image', authenticate, requireAdmin, imageUploadToDb.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Store image in database
    const image = await Image.create({
      name: req.file.originalname,
      alt: req.body.alt || req.file.originalname,
      data: req.file.buffer,
      contentType: req.file.mimetype,
      size: req.file.size,
      entityType: req.body.entityType || 'other',
      entityId: req.body.entityId || null,
      isPrimary: req.body.isPrimary === 'true' || req.body.isPrimary === true
    });

    const imageUrl = generateImageDbUrl(image._id.toString());
    
    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        id: image._id,
        url: imageUrl,
        filename: image.name,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('Image upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Upload multiple images to database
router.post('/images', authenticate, requireAdmin, imageUploadToDb.array('images', 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No image files provided'
      });
    }

    // Parse alt texts if provided
    let altTexts: string[] = [];
    if (req.body.alts) {
      try {
        altTexts = JSON.parse(req.body.alts);
      } catch {
        altTexts = req.body.alts.split(',').map((a: string) => a.trim());
      }
    }

    const uploadedImages = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      const alt = altTexts[i] || file.originalname;
      
      // Store image in database
      const image = await Image.create({
        name: file.originalname,
        alt: alt,
        data: file.buffer,
        contentType: file.mimetype,
        size: file.size,
        entityType: req.body.entityType || 'other',
        entityId: req.body.entityId || null,
        isPrimary: i === 0 // First image is primary by default
      });

      uploadedImages.push({
        id: image._id,
        url: generateImageDbUrl(image._id.toString()),
        filename: image.name,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      });
    }
    
    return res.status(200).json({
      success: true,
      message: `${files.length} images uploaded successfully`,
      data: uploadedImages
    });
  } catch (error) {
    console.error('Images upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload images',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Upload single video
router.post('/video', authenticate, requireAdmin, videoUpload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No video file provided'
      });
    }

    const videoUrl = generateFileUrl(req.file.filename, 'video');
    
    return res.status(200).json({
      success: true,
      message: 'Video uploaded successfully',
      data: {
        url: videoUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        // Calculate duration if needed (requires ffprobe or similar)
        // duration: await getVideoDuration(req.file.path)
      }
    });
  } catch (error) {
    console.error('Video upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload video',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Upload mixed media (images to database, videos to filesystem)
router.post('/media', authenticate, requireAdmin, mediaUpload.array('media', 15), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No media files provided'
      });
    }

    const uploadedMedia = [];
    
    for (const file of files) {
      const type = file.mimetype.startsWith('image/') ? 'image' : 'video';
      
      if (type === 'image') {
        // Read the file from disk and store in database
        const fs = await import('fs/promises');
        const fileData = await fs.readFile(file.path);
        
        const image: IImage = await Image.create({
          name: file.originalname,
          alt: file.originalname,
          data: fileData,
          contentType: file.mimetype,
          size: file.size,
          entityType: req.body.entityType || 'other',
          entityId: req.body.entityId || null,
          isPrimary: uploadedMedia.length === 0 // First image is primary
        }) as IImage;
        
        // Delete the file from filesystem after storing in db
        try {
          await fs.unlink(file.path);
        } catch (e) {
          console.error('Failed to delete temp file:', e);
        }
        
        uploadedMedia.push({
          id: image._id,
          url: generateImageDbUrl(image._id.toString()),
          filename: image.name,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          type: 'image'
        });
      } else {
        // Videos stay in filesystem
        uploadedMedia.push({
          url: generateFileUrl(file.filename, 'video'),
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          type: 'video'
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      message: `${files.length} media files uploaded successfully`,
      data: uploadedMedia
    });
  } catch (error) {
    console.error('Media upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload media files',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Analyze video file for codec compatibility
router.get('/video/analyze/:filename', authenticate, requireAdmin, analyzeVideoFile);

export default router;