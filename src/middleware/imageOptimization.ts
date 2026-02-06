import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { Request, Response, NextFunction } from 'express';

// Extend Express Request to include files from multer
interface RequestWithFiles extends Request {
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}

/**
 * Image Compression and Optimization Middleware
 */
export const optimizeImages = async (req: RequestWithFiles, res: Response, next: NextFunction) => {
  // Handle both array and object formats from multer
  let files: Express.Multer.File[] = [];
  
  if (req.files) {
    if (Array.isArray(req.files)) {
      files = req.files;
    } else if (typeof req.files === 'object') {
      // Flatten object of file arrays into single array
      files = Object.values(req.files).flat();
    }
  }

  if (files.length === 0) {
    return next();
  }

  try {
    console.log('🖼️ Optimizing uploaded images...');
    
    const optimizedFiles: Express.Multer.File[] = [];

    for (const file of files) {
      if (!file.mimetype.startsWith('image/')) {
        // Keep non-image files as is
        optimizedFiles.push(file);
        continue;
      }

      const originalSize = file.size;
      const filename = file.filename;
      const filepath = file.path;
      
      // Create optimized filename
      const ext = path.extname(filename);
      const name = path.basename(filename, ext);
      const optimizedFilename = `${name}_optimized.webp`;
      const optimizedPath = path.join(path.dirname(filepath), optimizedFilename);

      try {
        // Optimize image with Sharp
        await sharp(filepath)
          .resize(1200, 1200, { 
            fit: 'inside', 
            withoutEnlargement: true 
          })
          .webp({ 
            quality: 85,
            effort: 4 // Good balance between compression and speed
          })
          .toFile(optimizedPath);

        // Get optimized file stats
        const stats = await fs.stat(optimizedPath);
        const optimizedSize = stats.size;
        const compressionRatio = Math.round(((originalSize - optimizedSize) / originalSize) * 100);

        console.log(`✅ Image optimized: ${filename}`);
        console.log(`   Original: ${Math.round(originalSize / 1024)}KB`);
        console.log(`   Optimized: ${Math.round(optimizedSize / 1024)}KB`);
        console.log(`   Saved: ${compressionRatio}%`);

        // Update file object with optimized version
        const optimizedFile: Express.Multer.File = {
          ...file,
          filename: optimizedFilename,
          path: optimizedPath,
          size: optimizedSize,
          mimetype: 'image/webp'
        };

        optimizedFiles.push(optimizedFile);

        // Clean up original file if optimization was successful
        try {
          await fs.unlink(filepath);
        } catch (unlinkError) {
          console.warn(`⚠️ Could not delete original file: ${filepath}`);
        }

      } catch (optimizationError) {
        console.error(`❌ Image optimization failed for ${filename}:`, optimizationError);
        // Keep original file if optimization fails
        optimizedFiles.push(file);
      }
    }

    // Replace files with optimized versions
    if (Array.isArray(req.files)) {
      req.files = optimizedFiles;
    }
    
    console.log(`🎯 Image optimization complete: ${optimizedFiles.length} files processed`);
    next();

  } catch (error) {
    console.error('❌ Image optimization middleware error:', error);
    // Don't break the request if optimization fails
    next();
  }
};

/**
 * Video Compression Middleware (for future use)
 */
export const optimizeVideos = async (req: RequestWithFiles, res: Response, next: NextFunction) => {
  let files: Express.Multer.File[] = [];
  
  if (req.files) {
    if (Array.isArray(req.files)) {
      files = req.files;
    } else if (typeof req.files === 'object') {
      files = Object.values(req.files).flat();
    }
  }

  const videoFiles = files.filter((file: Express.Multer.File) => file.mimetype.startsWith('video/'));
  
  if (videoFiles.length === 0) {
    return next();
  }

  // For now, just log video files - actual compression can be added later
  console.log(`🎬 Video files detected: ${videoFiles.length}`);
  videoFiles.forEach((file: Express.Multer.File) => {
    console.log(`   - ${file.filename}: ${Math.round(file.size / 1024 / 1024)}MB`);
  });

  next();
};

/**
 * Generate responsive image variants
 */
export const generateResponsiveImages = async (imagePath: string) => {
  const sizes = [
    { width: 400, suffix: '_small' },
    { width: 800, suffix: '_medium' },
    { width: 1200, suffix: '_large' }
  ];

  const variants: Array<{size: number, path: string, url: string}> = [];
  const ext = path.extname(imagePath);
  const name = path.basename(imagePath, ext);
  const dir = path.dirname(imagePath);

  for (const size of sizes) {
    const variantPath = path.join(dir, `${name}${size.suffix}.webp`);
    
    try {
      await sharp(imagePath)
        .resize(size.width, null, { 
          withoutEnlargement: true 
        })
        .webp({ quality: 85 })
        .toFile(variantPath);

      variants.push({
        size: size.width,
        path: variantPath,
        url: variantPath.replace('public', '')
      });
    } catch (error) {
      console.error(`❌ Failed to create ${size.width}px variant:`, error);
    }
  }

  return variants;
};

export default {
  optimizeImages,
  optimizeVideos,
  generateResponsiveImages
};
