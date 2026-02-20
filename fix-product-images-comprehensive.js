/**
 * Fix Product Image URLs in Database (CommonJS)
 * This script identifies and fixes broken image URLs in product records
 */

const mongoose = require('mongoose');

// Define Product schema inline to avoid import issues
const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  shortDescription: { type: String },
  sku: { type: String, required: true, unique: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  images: [{
    url: { type: String, required: true },
    alt: { type: String, required: true },
    isPrimary: { type: Boolean, default: false }
  }],
  price: {
    original: { type: Number, required: true },
    selling: { type: Number, required: true },
    discount: { type: Number, default: 0 }
  },
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  inStock: { type: Boolean, default: true },
  stock: {
    quantity: { type: Number, default: 0 },
    reserved: { type: Number, default: 0 },
    available: { type: Number, default: 0 }
  }
}, { timestamps: true });

const Product = mongoose.model('Product', ProductSchema);

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
    let removedCount = 0;
    let errorCount = 0;
    let warningCount = 0;
    
    for (const product of products) {
      console.log(`\\n🔍 Checking product: ${product.name} (${product._id})`);
      
      try {
        let needsUpdate = false;
        const updatedImages = [];
        
        for (let i = 0; i < product.images.length; i++) {
          const imageData = product.images[i];
          const imageUrl = imageData.url;
          
          console.log(`   📸 Image ${i + 1}: ${imageUrl}`);
          
          // Check for problematic URLs
          if (imageUrl.startsWith('blob:')) {
            console.log(`   ❌ REMOVING blob URL: ${imageUrl}`);
            removedCount++;
            needsUpdate = true;
            continue; // Skip this image - don't add to updatedImages
          }
          
          if (imageUrl.startsWith('data:')) {
            console.log(`   ❌ REMOVING base64 data URL (too large): ${imageUrl.substring(0, 50)}...`);
            removedCount++;
            needsUpdate = true;
            continue; // Skip this image
          }
          
          if (!imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
            console.log(`   ⚠️ WARNING: Unusual URL format: ${imageUrl}`);
            warningCount++;
          }
          
          // Check if it's just an image ID (24 character hex string)
          const imageIdRegex = /^[0-9a-fA-F]{24}$/;
          if (imageIdRegex.test(imageUrl)) {
            console.log(`   🔧 Converting image ID to full URL: ${imageUrl}`);
            
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
            
            const newUrl = `${baseUrl}/api/v1/images/${imageUrl}`;
            console.log(`   ✅ New URL: ${newUrl}`);
            
            updatedImages.push({
              url: newUrl,
              alt: imageData.alt || `${product.name} image ${i + 1}`,
              isPrimary: imageData.isPrimary || i === 0
            });
            needsUpdate = true;
          } else if (!imageUrl.includes('/api/v1/images/') && imageUrl.startsWith('http')) {
            console.log(`   🔧 External URL, keeping as-is: ${imageUrl}`);
            updatedImages.push(imageData);
          } else if (imageUrl.includes('/api/v1/images/')) {
            console.log(`   ✅ URL looks correct: ${imageUrl}`);
            updatedImages.push(imageData);
          } else {
            console.log(`   ⚠️ Unusual URL pattern: ${imageUrl}`);
            // Keep it but mark as warning
            updatedImages.push(imageData);
            warningCount++;
          }
        }
        
        // Update the product if needed
        if (needsUpdate) {
          if (updatedImages.length === 0) {
            console.log(`   ⚠️ All images removed for ${product.name} - setting empty array`);
          }
          
          await Product.findByIdAndUpdate(product._id, { images: updatedImages });
          console.log(`   ✅ Updated product ${product.name} (${updatedImages.length} images remaining)`);
          fixedCount++;
        } else {
          console.log(`   ℹ️ No changes needed for ${product.name}`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error processing product ${product.name}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\\n📊 Fix Summary:`);
    console.log(`   ✅ Products fixed: ${fixedCount}`);
    console.log(`   🗑️ Broken images removed: ${removedCount}`);
    console.log(`   ⚠️ Warnings: ${warningCount}`);
    console.log(`   ❌ Products with errors: ${errorCount}`);
    console.log(`   📦 Total products checked: ${products.length}`);
    
    if (fixedCount > 0) {
      console.log(`\\n💡 Recommendation: Test the admin panel and customer website to ensure images display correctly.`);
    }
    
    if (removedCount > 0) {
      console.log(`\\n⚠️ Note: ${removedCount} broken images were removed. You may need to re-upload images for affected products.`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing product image URLs:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\\n✅ Database connection closed');
  }
};

// Run the fix
fixProductImageUrls().catch(console.error);