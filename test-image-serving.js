/**
 * Test Image Serving Functionality
 * Run this script to test image upload and serving in production
 */

import mongoose from 'mongoose';
import { Image } from './src/models/index.js';

const testImageServing = async () => {
  try {
    console.log('🔍 Testing image serving functionality...');
    
    // Connect to production database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hipro-comm-db';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database');
    
    // Find some existing images
    const images = await Image.find({}).limit(5).select('_id name contentType size entityType');
    
    if (images.length === 0) {
      console.log('⚠️ No images found in database');
      return;
    }
    
    console.log(`📸 Found ${images.length} images in database:`);
    
    for (const image of images) {
      console.log(`\n🖼️ Image: ${image.name}`);
      console.log(`   ID: ${image._id}`);
      console.log(`   Type: ${image.contentType}`);
      console.log(`   Size: ${image.size} bytes`);
      console.log(`   Entity: ${image.entityType}`);
      
      // Generate URL using the same logic as the application
      let baseUrl;
      if (process.env.API_BASE_URL) {
        baseUrl = process.env.API_BASE_URL;
      } else if (process.env.NODE_ENV === 'production') {
        baseUrl = 'https://shop.hiprotech.org';
      } else {
        baseUrl = 'http://localhost:5001';
      }
      baseUrl = baseUrl.replace(/\/$/, '');
      
      const imageUrl = `${baseUrl}/api/v1/images/${image._id}`;
      console.log(`   URL: ${imageUrl}`);
      
      // Test if the URL is accessible
      try {
        const response = await fetch(imageUrl, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Image-Test-Script/1.0'
          }
        });
        
        if (response.ok) {
          console.log(`   ✅ Status: ${response.status} - Image is accessible`);
          console.log(`   📋 Content-Type: ${response.headers.get('content-type')}`);
          console.log(`   📏 Content-Length: ${response.headers.get('content-length')}`);
        } else {
          console.log(`   ❌ Status: ${response.status} - Image is not accessible`);
          console.log(`   📋 Response: ${response.statusText}`);
        }
      } catch (error) {
        console.log(`   ❌ Error accessing image: ${error.message}`);
      }
    }
    
    // Test environment configuration
    console.log('\n🌍 Environment Configuration:');
    console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`   API_BASE_URL: ${process.env.API_BASE_URL || 'not set'}`);
    console.log(`   MONGODB_URI: ${mongoUri}`);
    
  } catch (error) {
    console.error('❌ Error testing image serving:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  }
};

// Run the test
testImageServing().catch(console.error);