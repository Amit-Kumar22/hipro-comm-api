// Script to clean blob URLs from existing products
const mongoose = require('mongoose');

// MongoDB connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hiprotech-ecommerce', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Product schema (simplified)
const productSchema = new mongoose.Schema({
  name: String,
  video: {
    url: String,
    title: String,
    duration: Number,
    size: Number,
    format: String,
  }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

const cleanBlobUrls = async () => {
  try {
    console.log('🔍 Searching for products with blob URLs...');
    
    // Find products with blob URLs in video field
    const productsWithBlobUrls = await Product.find({
      'video.url': { $regex: '^blob:' }
    });
    
    console.log(`Found ${productsWithBlobUrls.length} products with blob URLs`);
    
    if (productsWithBlobUrls.length > 0) {
      // Remove video field from products with blob URLs
      const result = await Product.updateMany(
        { 'video.url': { $regex: '^blob:' } },
        { $unset: { video: "" } }
      );
      
      console.log(`✅ Cleaned ${result.modifiedCount} products by removing blob URL videos`);
      
      // List affected products
      productsWithBlobUrls.forEach(product => {
        console.log(`- ${product.name} (ID: ${product._id})`);
      });
    } else {
      console.log('✅ No products with blob URLs found');
    }
    
  } catch (error) {
    console.error('❌ Error cleaning blob URLs:', error);
  }
};

const main = async () => {
  await connectDB();
  await cleanBlobUrls();
  await mongoose.connection.close();
  console.log('🏁 Script completed');
};

main().catch(console.error);