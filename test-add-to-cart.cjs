#!/usr/bin/env node

const axios = require('axios');

const API_BASE_URL = process.env.API_URL || 'http://localhost:3001/api/v1';

// Test credentials (you'll need to adjust these)
const testUser = {
  email: 'test@example.com',
  password: 'password123'
};

let authToken = '';
let testProducts = [];

async function makeRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { Authorization: `Bearer ${authToken}` })
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.message || error.message,
      status: error.response?.status 
    };
  }
}

async function testAddToCart() {
  console.log('🧪 Testing Add to Cart Functionality\n');

  // Step 1: Get products
  console.log('🔹 Step 1: Fetching products...');
  const productsResult = await makeRequest('GET', '/products');
  
  if (!productsResult.success) {
    console.log('❌ Failed to fetch products:', productsResult.error);
    return;
  }

  testProducts = productsResult.data.data.products;
  console.log(`✅ Found ${testProducts.length} products`);
  
  if (testProducts.length === 0) {
    console.log('❌ No products found. Please run create-test-products.cjs first');
    return;
  }

  // Find our test products
  const schoolRobotics = testProducts.find(p => p.name.includes('School Robotics'));
  const homeLearning = testProducts.find(p => p.name.includes('Home Learning'));

  if (!schoolRobotics || !homeLearning) {
    console.log('❌ Test products not found. Available products:');
    testProducts.forEach(p => console.log(`   - ${p.name}`));
    return;
  }

  console.log(`\n📦 Test Products Found:`);
  console.log(`   🤖 ${schoolRobotics.name}`);
  console.log(`      - Stock Available: ${schoolRobotics.stock?.available || 'undefined'}`);
  console.log(`      - Inventory Available: ${schoolRobotics.inventory?.availableForSale || 'undefined'}`);
  console.log(`      - In Stock: ${schoolRobotics.inStock}`);
  
  console.log(`   🏠 ${homeLearning.name}`);
  console.log(`      - Stock Available: ${homeLearning.stock?.available || 'undefined'}`);
  console.log(`      - Inventory Available: ${homeLearning.inventory?.availableForSale || 'undefined'}`);
  console.log(`      - In Stock: ${homeLearning.inStock}`);

  // Step 2: Try to register/login a test user
  console.log('\n🔹 Step 2: Setting up test user...');
  
  // Try to register first
  const registerResult = await makeRequest('POST', '/auth/customer/register', {
    name: 'Test User',
    email: testUser.email,
    password: testUser.password,
    phone: '1234567890'
  });

  // Whether register succeeds or fails, try to login
  const loginResult = await makeRequest('POST', '/auth/customer/login', testUser);
  
  if (!loginResult.success) {
    console.log('❌ Failed to login:', loginResult.error);
    return;
  }

  authToken = loginResult.data.data.token;
  console.log('✅ Logged in successfully');

  // Step 3: Test add to cart for School Robotics Kit
  console.log('\n🔹 Step 3: Testing add to cart for School Robotics Kit...');
  
  const addToCartResult1 = await makeRequest('POST', '/cart/add', {
    productId: schoolRobotics._id,
    quantity: 1
  });

  if (addToCartResult1.success) {
    console.log('✅ School Robotics Kit added to cart successfully!');
    console.log(`   Cart Total: ₹${addToCartResult1.data.data.cartTotal}`);
  } else {
    console.log('❌ Failed to add School Robotics Kit to cart:', addToCartResult1.error);
  }

  // Step 4: Test add to cart for Home Learning Kit
  console.log('\n🔹 Step 4: Testing add to cart for Home Learning Kit...');
  
  const addToCartResult2 = await makeRequest('POST', '/cart/add', {
    productId: homeLearning._id,
    quantity: 2
  });

  if (addToCartResult2.success) {
    console.log('✅ Home Learning Kit added to cart successfully!');
    console.log(`   Cart Total: ₹${addToCartResult2.data.data.cartTotal}`);
  } else {
    console.log('❌ Failed to add Home Learning Kit to cart:', addToCartResult2.error);
  }

  // Step 5: Get cart contents
  console.log('\n🔹 Step 5: Checking cart contents...');
  
  const cartResult = await makeRequest('GET', '/cart');
  
  if (cartResult.success) {
    const cart = cartResult.data.data;
    console.log(`✅ Cart retrieved successfully!`);
    console.log(`   Items in cart: ${cart.totals.totalItems}`);
    console.log(`   Cart total: ₹${cart.totals.total}`);
    
    cart.items.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.product.name} (Qty: ${item.quantity}) - ₹${item.itemTotal}`);
    });
  } else {
    console.log('❌ Failed to get cart:', cartResult.error);
  }

  console.log('\n🎉 Add to Cart functionality test completed!');
}

// Run the test
testAddToCart().catch(error => {
  console.error('❌ Test failed with error:', error.message);
});