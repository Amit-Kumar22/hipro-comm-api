const { MongoClient } = require('mongodb');

// Try different possible MongoDB URLs
const possibleUrls = [
  process.env.MONGODB_URI || 'mongodb://localhost:27017/hipro-comm-db',
  'mongodb://127.0.0.1:27017/hipro-comm-db'
].filter(Boolean);

async function checkDatabase() {
  for (const url of possibleUrls) {
    const client = new MongoClient(url);
    
    try {
      console.log(`\n🔗 Trying to connect to: ${url}`);
      await client.connect();
      
      const db = client.db();
      const collections = await db.listCollections().toArray();
      
      console.log(`✅ Connected successfully!`);
      console.log(`📚 Available collections:`, collections.map(c => c.name));
      
      // Check products collection
      if (collections.some(c => c.name === 'products')) {
        const productsCollection = db.collection('products');
        const productCount = await productsCollection.countDocuments();
        console.log(`📦 Products in collection: ${productCount}`);
        
        if (productCount > 0) {
          const sampleProducts = await productsCollection.find({}).limit(3).toArray();
          console.log(`\n📋 Sample products:`);
          sampleProducts.forEach(product => {
            console.log(`  - ${product.name} (ID: ${product._id})`);
            console.log(`    inventory:`, product.inventory);
            console.log(`    stock:`, product.stock);
          });
        } else {
          console.log(`\n🎯 Adding sample products with stock...`);
          
          const sampleProducts = [
            {
              name: "Sample Gaming Laptop",
              slug: "sample-gaming-laptop",
              description: "High-performance gaming laptop for developers and gamers",
              shortDescription: "Powerful gaming laptop with RTX graphics",
              sku: "LAPTOP-001",
              price: {
                original: 75000,
                selling: 65000,
                discount: 13
              },
              images: [
                {
                  url: "https://via.placeholder.com/400x400.png?text=Gaming+Laptop",
                  alt: "Gaming Laptop",
                  isPrimary: true
                }
              ],
              category: null,
              inventory: {
                availableForSale: 25,
                reserved: 0,
                damaged: 0,
                isOutOfStock: false,
                isLowStock: false,
                lastRestockedAt: new Date(),
                notes: "Initial stock"
              },
              isActive: true,
              isFeatured: true,
              createdAt: new Date(),
              updatedAt: new Date()
            },
            {
              name: "Wireless Gaming Mouse",
              slug: "wireless-gaming-mouse",
              description: "Ergonomic wireless gaming mouse with RGB lighting",
              shortDescription: "Professional gaming mouse with precision tracking",
              sku: "MOUSE-001",
              price: {
                original: 3500,
                selling: 2800,
                discount: 20
              },
              images: [
                {
                  url: "https://via.placeholder.com/400x400.png?text=Gaming+Mouse",
                  alt: "Gaming Mouse",
                  isPrimary: true
                }
              ],
              category: null,
              inventory: {
                availableForSale: 50,
                reserved: 2,
                damaged: 0,
                isOutOfStock: false,
                isLowStock: false,
                lastRestockedAt: new Date(),
                notes: "Popular item, good stock"
              },
              isActive: true,
              isFeatured: false,
              createdAt: new Date(),
              updatedAt: new Date()
            },
            {
              name: "Mechanical Keyboard",
              slug: "mechanical-keyboard",
              description: "RGB mechanical keyboard with Cherry MX switches",
              shortDescription: "Professional mechanical keyboard for typing and gaming",
              sku: "KEYBOARD-001",
              price: {
                original: 8500,
                selling: 6800,
                discount: 20
              },
              images: [
                {
                  url: "https://via.placeholder.com/400x400.png?text=Mechanical+Keyboard",
                  alt: "Mechanical Keyboard",
                  isPrimary: true
                }
              ],
              category: null,
              inventory: {
                availableForSale: 5,  // Low stock example
                reserved: 0,
                damaged: 1,
                isOutOfStock: false,
                isLowStock: true,
                lastRestockedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
                notes: "Low stock - need to reorder"
              },
              isActive: true,
              isFeatured: false,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ];
          
          const insertResult = await productsCollection.insertMany(sampleProducts);
          console.log(`✅ Added ${insertResult.insertedCount} sample products`);
        }
      }
      
      await client.close();
      console.log(`\n🎉 Database check completed for ${url}`);
      return; // Exit after first successful connection
      
    } catch (error) {
      console.log(`❌ Failed to connect to ${url}:`, error.message);
      await client.close();
    }
  }
  
  console.log('\n❌ Could not connect to any MongoDB instance');
  console.log('💡 Make sure MongoDB is running and check your connection settings');
}

checkDatabase().catch(console.error);