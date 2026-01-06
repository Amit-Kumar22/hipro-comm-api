/**
 * Fix Product Stock Script
 * Updates all products with proper stock quantities
 */

const mongoose = require('mongoose');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hipro-comm-db';

// Product schema (simplified)
const ProductSchema = new mongoose.Schema({}, { strict: false });
const Product = mongoose.model('Product', ProductSchema);

async function fixProductStock() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    
    console.log('Fetching all products...');
    const products = await Product.find({});
    
    console.log(`Found ${products.length} products. Updating stock...`);
    
    let updated = 0;
    for (const product of products) {
      // Set stock quantities to reasonable amounts
      const baseQuantity = Math.floor(Math.random() * 100) + 50; // 50-150 random stock
      
      await Product.updateOne(
        { _id: product._id },
        {
          $set: {
            'stock.quantity': baseQuantity,
            'stock.reserved': 0,
            'stock.available': baseQuantity,
            'inStock': true
          }
        }
      );
      
      updated++;
      console.log(`Updated ${product.name}: ${baseQuantity} stock`);
    }
    
    console.log(`✅ Successfully updated ${updated} products!`);
    
  } catch (error) {
    console.error('❌ Error updating stock:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
fixProductStock();