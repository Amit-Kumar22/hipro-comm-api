import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Create upload directory if it doesn't exist
const createUploadDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Configure multer for image uploads
const imageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/images/';
    createUploadDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + crypto.randomUUID();
    const fileExtension = path.extname(file.originalname);
    cb(null, 'image-' + uniqueSuffix + fileExtension);
  }
});

// Configure multer for video uploads
const videoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/videos/';
    createUploadDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + crypto.randomUUID();
    const fileExtension = path.extname(file.originalname);
    cb(null, 'video-' + uniqueSuffix + fileExtension);
  }
});

// File filter for images
const imageFileFilter = (req: any, file: any, cb: any) => {
  // Check file type
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// File filter for videos - restricted to web-safe formats for better browser compatibility
const videoFileFilter = (req: any, file: any, cb: any) => {
  const allowedMimeTypes = [
    'video/mp4',     // Most widely supported
    'video/webm',    // Good for modern browsers
    'video/ogg',     // Open source alternative
    // Removed problematic formats: AVI, MOV, WMV, 3GPP which often have codec issues
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only web-compatible video files (MP4, WebM, OGG) are allowed for optimal playback!'), false);
  }
};

// Image upload configuration
export const imageUpload = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB for images
  }
});

// Video upload configuration  
export const videoUpload = multer({
  storage: videoStorage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB for videos
  }
});

// Combined upload for both images and videos
export const mediaUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      let uploadPath;
      if (file.mimetype.startsWith('image/')) {
        uploadPath = 'uploads/images/';
      } else if (file.mimetype.startsWith('video/')) {
        uploadPath = 'uploads/videos/';
      } else {
        uploadPath = 'uploads/misc/';
      }
      createUploadDir(uploadPath);
      cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + crypto.randomUUID();
      const fileExtension = path.extname(file.originalname);
      const prefix = file.mimetype.startsWith('image/') ? 'image' : 'video';
      cb(null, prefix + '-' + uniqueSuffix + fileExtension);
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      // Videos
      'video/mp4',
      'video/mpeg',
      'video/ogg',
      'video/webm',
      'video/3gpp',
      'video/3gpp2',
      'video/avi',
      'video/x-msvideo',
      'video/quicktime',
      'video/x-ms-wmv'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!') as any, false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  }
});

// Helper function to generate file URL
export const generateFileUrl = (filename: string, type: 'image' | 'video' = 'image'): string => {
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://shop.hiprotech.org' 
    : (process.env.API_BASE_URL || 'http://localhost:5001');
  return `${baseUrl}/uploads/${type}s/${filename}`;
};

// Helper function to delete file
export const deleteFile = (filePath: string): void => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }
};

export default {
  imageUpload,
  videoUpload,
  mediaUpload,
  generateFileUrl,
  deleteFile
};