const { MongoClient, ObjectId } = require('mongodb');

async function fixProductStock() {
  const client = new MongoClient('mongodb://localhost:27017/hipro-ecommerce');
  
  try {
    await client.connect();
    const db = client.db();
    
    console.log('🔧 Fixing product stock inconsistencies...');
    
    // Get all products and inventories
    const products = await db.collection('products').find({}).toArray();
    const inventories = await db.collection('inventories').find({}).toArray();
    
    console.log(`Found ${products.length} products and ${inventories.length} inventories`);
    
    let fixed = 0;
    
    for (const product of products) {
      const inventory = inventories.find(inv => inv.product.toString() === product._id.toString());
      
      console.log(`\nProduct: ${product.name}`);
      console.log(`  Current stock:`, product.stock);
      console.log(`  Has inventory:`, !!inventory);
      
      if (inventory) {
        console.log(`  Inventory data:`, {
          availableForSale: inventory.availableForSale,
          quantityAvailable: inventory.quantityAvailable,
          quantityReserved: inventory.quantityReserved
        });
      }
      
      // Fix stock inconsistencies
      let needsUpdate = false;
      let newStock = { ...product.stock };
      
      if (inventory && inventory.quantityAvailable > 0) {
        // If inventory has stock but product stock shows 0, update product stock
        if (product.stock.available === 0 && inventory.quantityAvailable > 0) {
          console.log(`  ⚠️  Fixing stock: product shows 0 but inventory shows ${inventory.quantityAvailable}`);
          newStock.quantity = inventory.quantityAvailable + (inventory.quantityReserved || 0);
          newStock.reserved = inventory.quantityReserved || 0;
          newStock.available = inventory.quantityAvailable;
          needsUpdate = true;
        }
      } else if (!inventory && product.stock.available === 0 && product.stock.quantity > 0) {
        // If no inventory but product has quantity, fix available stock
        console.log(`  ⚠️  Fixing available stock calculation`);
        newStock.available = Math.max(0, product.stock.quantity - (product.stock.reserved || 0));
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await db.collection('products').updateOne(
          { _id: product._id },
          { 
            $set: { 
              stock: newStock,
              inStock: newStock.available > 0,
              updatedAt: new Date()
            }
          }
        );
        console.log(`  ✅ Updated stock:`, newStock);
        fixed++;
      } else {
        console.log(`  ✓ Stock OK`);
      }
    }
    
    console.log(`\n🎉 Fixed ${fixed} products with stock inconsistencies`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

fixProductStock();