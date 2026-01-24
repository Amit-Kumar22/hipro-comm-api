const { MongoClient, ObjectId } = require('mongodb');

async function checkCartItem() {
  const client = new MongoClient('mongodb://localhost:27017/hipro-ecommerce');
  
  try {
    await client.connect();
    const db = client.db();
    
    // Look for cart items with this ID
    const carts = await db.collection('carts').find({}).toArray();
    console.log('Total carts found:', carts.length);
    
    let found = false;
    carts.forEach(cart => {
      console.log('Cart ID:', cart._id.toString());
      console.log('Customer:', cart.customer);
      console.log('Items count:', cart.items?.length || 0);
      
      if (cart.items) {
        cart.items.forEach((item, index) => {
          console.log(`  Item ${index}: ID=${item._id?.toString()}, Product=${item.product?.toString()}, Quantity=${item.quantity}`);
          
          if (item._id?.toString() === '6974975441fc8174bb8dd3a9') {
            console.log('*** FOUND THE PROBLEMATIC CART ITEM! ***');
            console.log('Full item details:', JSON.stringify(item, null, 2));
            found = true;
          }
        });
      }
      console.log('---');
    });
    
    if (!found) {
      console.log('❌ Cart item with ID 6974975441fc8174bb8dd3a9 not found in any cart');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

checkCartItem();