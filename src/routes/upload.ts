import express from 'express';
import { imageUpload, videoUpload, mediaUpload, generateFileUrl } from '../services/uploadService.js';
import { authenticate, requireAdmin } from '../middleware/authMiddleware.js';
import { analyzeVideoFile } from '../controllers/videoAnalysisController.js';

const router = express.Router();

// Upload single image
router.post('/image', authenticate, requireAdmin, imageUpload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const imageUrl = generateFileUrl(req.file.filename, 'image');
    
    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: imageUrl,
        filename: req.file.filename,
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

// Upload multiple images
router.post('/images', authenticate, requireAdmin, imageUpload.array('images', 10), (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No image files provided'
      });
    }

    const uploadedImages = files.map(file => ({
      url: generateFileUrl(file.filename, 'image'),
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype
    }));
    
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

// Upload mixed media (images and videos)
router.post('/media', authenticate, requireAdmin, mediaUpload.array('media', 15), (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No media files provided'
      });
    }

    const uploadedMedia = files.map(file => {
      const type = file.mimetype.startsWith('image/') ? 'image' : 'video';
      return {
        url: generateFileUrl(file.filename, type),
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        type
      };
    });
    
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