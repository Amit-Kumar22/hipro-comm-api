/**
 * Fix Product Image URLs in Database
 * Run this script to fix any broken or inconsistent image URLs
 */

import mongoose from 'mongoose';
import { Product, Image } from './src/models/index.js';

const fixProductImageUrls = async () => {
  try {
    console.log('🔧 Starting product image URL fix...');
    
    // Connect to database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hipro-comm-db';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database');
    
    // Find all products with images
    const products = await Product.find({ 'images.0': { $exists: true } });
    console.log(`📦 Found ${products.length} products with images`);
    
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const product of products) {
      console.log(`\n🔍 Checking product: ${product.name} (${product._id})`);
      
      try {
        let needsUpdate = false;
        const updatedImages = [];
        
        for (let i = 0; i < product.images.length; i++) {
          const imageData = product.images[i];
          console.log(`   📸 Image ${i + 1}: ${imageData.url}`);
          
          // Check if it's just an image ID (24 character hex string)
          const imageIdRegex = /^[0-9a-fA-F]{24}$/;
          if (imageIdRegex.test(imageData.url)) {
            console.log(`   🔧 Converting image ID to full URL: ${imageData.url}`);
            
            // Verify the image exists in the database
            const imageExists = await Image.findById(imageData.url);
            if (imageExists) {
              // Generate proper URL
              let baseUrl;
              if (process.env.API_BASE_URL) {
                baseUrl = process.env.API_BASE_URL;
              } else if (process.env.NODE_ENV === 'production') {
                baseUrl = 'https://shop.hiprotech.org';
              } else {
                baseUrl = 'http://localhost:5001';
              }
              baseUrl = baseUrl.replace(/\/$/, '');
              
              const newUrl = `${baseUrl}/api/v1/images/${imageData.url}`;
              console.log(`   ✅ New URL: ${newUrl}`);
              
              updatedImages.push({
                url: newUrl,
                alt: imageData.alt || `${product.name} image ${i + 1}`,
                isPrimary: imageData.isPrimary || i === 0
              });
              needsUpdate = true;
            } else {
              console.log(`   ❌ Image not found in database: ${imageData.url}`);
              // Keep the original URL but log the issue
              updatedImages.push(imageData);
            }
          } else if (!imageData.url.includes('/api/v1/images/') && !imageData.url.startsWith('http')) {
            console.log(`   🔧 Fixing relative URL: ${imageData.url}`);
            
            // Try to extract image ID from URL
            const idMatch = imageData.url.match(/([0-9a-fA-F]{24})/);
            if (idMatch) {
              const imageId = idMatch[1];
              const imageExists = await Image.findById(imageId);
              
              if (imageExists) {
                let baseUrl;
                if (process.env.API_BASE_URL) {
                  baseUrl = process.env.API_BASE_URL;
                } else if (process.env.NODE_ENV === 'production') {
                  baseUrl = 'https://shop.hiprotech.org';
                } else {
                  baseUrl = 'http://localhost:5001';
                }
                baseUrl = baseUrl.replace(/\/$/, '');
                
                const newUrl = `${baseUrl}/api/v1/images/${imageId}`;
                console.log(`   ✅ Fixed URL: ${newUrl}`);
                
                updatedImages.push({
                  url: newUrl,
                  alt: imageData.alt || `${product.name} image ${i + 1}`,
                  isPrimary: imageData.isPrimary || i === 0
                });
                needsUpdate = true;
              } else {
                console.log(`   ❌ Image not found in database: ${imageId}`);
                updatedImages.push(imageData);
              }
            } else {
              console.log(`   ⚠️ Could not extract image ID from: ${imageData.url}`);
              updatedImages.push(imageData);
            }
          } else {
            console.log(`   ✅ URL looks correct: ${imageData.url}`);
            updatedImages.push(imageData);
          }
        }
        
        // Update the product if needed
        if (needsUpdate) {
          await Product.findByIdAndUpdate(product._id, { images: updatedImages });
          console.log(`   ✅ Updated product ${product.name}`);
          fixedCount++;
        } else {
          console.log(`   ℹ️ No changes needed for ${product.name}`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error processing product ${product.name}:`, error);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Fix Summary:`);
    console.log(`   ✅ Products fixed: ${fixedCount}`);
    console.log(`   ❌ Products with errors: ${errorCount}`);
    console.log(`   📦 Total products checked: ${products.length}`);
    
  } catch (error) {
    console.error('❌ Error fixing product image URLs:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  }
};

// Run the fix
fixProductImageUrls().catch(console.error);