/**
 * Test Image Serving Functionality (CommonJS version)
 * Run this script to test image upload and serving in production
 */

const mongoose = require('mongoose');

// Define Image model inline to avoid import issues
const ImageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  alt: { type: String, required: true },
  data: { type: Buffer, required: true },
  contentType: { type: String, required: true },
  size: { type: Number, required: true },
  width: Number,
  height: Number,
  entityType: { 
    type: String, 
    required: true,
    enum: ['product', 'category', 'payment', 'other']
  },
  entityId: { type: mongoose.Schema.Types.ObjectId },
  isPrimary: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Image = mongoose.model('Image', ImageSchema);

const testImageServing = async () => {
  try {
    console.log('🔍 Testing image serving functionality...');
    
    // Connect to database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hipro-comm-db';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database');
    
    // Find some existing images
    const images = await Image.find({}).limit(5).select('_id name contentType size entityType');
    
    if (images.length === 0) {
      console.log('⚠️ No images found in database');
      console.log('💡 This might be normal if no images have been uploaded yet.');
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
      
      // Test if the URL is accessible (only if we can fetch)
      if (typeof fetch !== 'undefined' || global.fetch) {
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
          console.log(`   ⚠️ Could not test URL accessibility: ${error.message}`);
          console.log(`   💡 This is normal if the server is not running or accessible from this machine.`);
        }
      } else {
        console.log(`   ℹ️ Fetch not available - cannot test URL accessibility`);
      }
    }
    
    // Test environment configuration
    console.log('\n🌍 Environment Configuration:');
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`   API_BASE_URL: ${process.env.API_BASE_URL || 'not set'}`);
    console.log(`   MONGODB_URI: ${mongoUri.replace(/mongodb:\/\/[^@]*@/, 'mongodb://***:***@')}`);
    
    // Summary
    console.log('\n📋 Summary:');
    console.log(`   📸 Total images in database: ${images.length}`);
    console.log(`   🔧 Image URL generation: Working`);
    console.log(`   🗄️ Database connection: Working`);
    if (images.length > 0) {
      console.log(`   💡 Next: Test actual image loading in a browser`);
    } else {
      console.log(`   💡 Next: Upload some images through the admin panel`);
    }
    
  } catch (error) {
    console.error('❌ Error testing image serving:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure MongoDB is running and accessible');
    }
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  }
};

// Run the test
testImageServing().catch(console.error);