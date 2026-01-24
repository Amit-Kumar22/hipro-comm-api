const { MongoClient } = require('mongodb');

// MongoDB connection URL
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/hipro-ecommerce';

async function fixProductStock() {
  const client = new MongoClient(MONGO_URL);
  
  try {
    await client.connect();
    console.log('📡 Connected to MongoDB');
    
    const db = client.db();
    const productsCollection = db.collection('products');
    
    // First, let's check current product inventory status
    console.log('\n🔍 Checking current product inventory...');
    const products = await productsCollection.find({}).toArray();
    
    console.log(`Found ${products.length} products`);
    
    for (const product of products) {
      console.log('\n📦 Product:', product.name);
      console.log('  - ID:', product._id.toString());
      console.log('  - Current inventory:', product.inventory);
      console.log('  - Current stock:', product.stock);
    }
    
    // Update products to have proper inventory
    console.log('\n🔧 Updating product inventory...');
    const updateResult = await productsCollection.updateMany(
      { 
        $or: [
          { inventory: { $exists: false } },
          { 'inventory.availableForSale': { $lte: 0 } },
          { 'inventory.availableForSale': null }
        ]
      },
      {
        $set: {
          inventory: {
            availableForSale: 50, // Set stock to 50 items
            reserved: 0,
            damaged: 0,
            isOutOfStock: false,
            isLowStock: false,
            lastRestockedAt: new Date(),
            notes: 'Stock initialized by fix script'
          }
        }
      }
    );
    
    console.log(`✅ Updated ${updateResult.modifiedCount} products with proper inventory`);
    
    // Also update any products that have old stock format
    const stockUpdateResult = await productsCollection.updateMany(
      { 
        stock: { $exists: true },
        $or: [
          { 'stock.available': { $lte: 0 } },
          { 'stock.available': null },
          { 'stock.available': { $exists: false } }
        ]
      },
      {
        $set: {
          'stock.available': 50,
          'stock.reserved': 0,
          'inventory': {
            availableForSale: 50,
            reserved: 0,
            damaged: 0,
            isOutOfStock: false,
            isLowStock: false,
            lastRestockedAt: new Date(),
            notes: 'Stock updated by fix script'
          }
        }
      }
    );
    
    console.log(`✅ Updated ${stockUpdateResult.modifiedCount} products with old stock format`);
    
    // Verify the update
    console.log('\n✨ Verification - checking updated products...');
    const updatedProducts = await productsCollection.find({}).toArray();
    
    for (const product of updatedProducts) {
      const availableStock = product.inventory?.availableForSale || product.stock?.available || 0;
      console.log(`📦 ${product.name}: ${availableStock} items available`);
    }
    
    console.log('\n🎉 Product stock fix completed!');
    
  } catch (error) {
    console.error('❌ Error fixing product stock:', error);
  } finally {
    await client.close();
    console.log('📡 MongoDB connection closed');
  }
}

// Run the fix
fixProductStock().catch(console.error);