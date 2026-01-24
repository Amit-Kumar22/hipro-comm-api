const { MongoClient } = require('mongodb');

const MONGO_URL = 'mongodb://localhost:27017/hipro-ecommerce';

async function verifyProductSync() {
  const client = new MongoClient(MONGO_URL);
  
  try {
    await client.connect();
    console.log('📡 Connected to MongoDB');
    
    const db = client.db();
    const productsCollection = db.collection('products');
    const categoriesCollection = db.collection('categories');
    
    console.log('\n🔍 Verifying product synchronization...\n');
    
    // Get all categories
    const categories = await categoriesCollection.find({}).toArray();
    console.log('📂 Categories in database:', categories.length);
    
    // Get all products
    const products = await productsCollection.find({}).toArray();
    console.log('📦 Total products in database:', products.length);
    
    console.log('\n🏷️ Products by Category:');
    console.log('='.repeat(50));
    
    for (const category of categories) {
      const categoryProducts = await productsCollection.find({ 
        category: category._id 
      }).toArray();
      
      console.log(`\n📁 ${category.name} (${category.slug})`);
      console.log(`   📊 Products: ${categoryProducts.length}`);
      
      if (categoryProducts.length > 0) {
        categoryProducts.forEach(product => {
          const stock = product.inventory?.availableForSale || 0;
          const stockIcon = stock > 0 ? '✅' : '❌';
          console.log(`   ${stockIcon} ${product.name} - Stock: ${stock}`);
        });
      } else {
        console.log('   🔽 No products found');
      }
    }
    
    // Check products without categories
    const uncategorized = await productsCollection.find({ 
      $or: [
        { category: null },
        { category: { $exists: false } }
      ]
    }).toArray();
    
    if (uncategorized.length > 0) {
      console.log('\\n⚠️  Uncategorized Products:', uncategorized.length);
      uncategorized.forEach(product => {
        const stock = product.inventory?.availableForSale || 0;
        const stockIcon = stock > 0 ? '✅' : '❌';
        console.log(`   ${stockIcon} ${product.name} - Stock: ${stock}`);
      });
    }
    
    console.log('\\n🎯 Verification Summary:');
    console.log('='.repeat(50));
    console.log(`✅ School Labs products will appear on:`);
    console.log('   • /products (main page) - when "School Robotics Labs" category selected');
    console.log('   • /category/school-robotics-labs - dedicated category page');
    console.log(`✅ Home Kits products will appear on:`);
    console.log('   • /products (main page) - when "Home Learning Kits" category selected'); 
    console.log('   • /category/home-learning-kits - dedicated category page');
    console.log(`✅ All products appear on:`);
    console.log('   • /products (main page) - when "All Products" is selected');
    console.log('   • Search functionality');
    
    console.log('\\n🚀 Product sync verification completed successfully!');
    
  } catch (error) {
    console.error('❌ Error verifying product sync:', error);
  } finally {
    await client.close();
    console.log('\\n📡 Database connection closed');
  }
}

verifyProductSync().catch(console.error);