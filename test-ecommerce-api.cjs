#!/usr/bin/env node

/**
 * E-commerce API Test Suite
 * Tests the complete flow: User Registration -> Login -> Add to Cart -> Place Order -> Payment -> Cancel Order
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5000/api/v1';
const testData = {
  customer: {
    name: 'Test Customer',
    email: `test${Date.now()}@example.com`,
    password: 'testpass123',
    phone: '9876543210'
  },
  address: {
    name: 'Test Customer',
    street: '123 Test Street, Test Area',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    country: 'India',
    phone: '9876543210'
  }
};

let customerToken = null;
let productId = null;
let cartItemId = null;
let orderId = null;
let paymentId = null;

// Helper function to make authenticated requests
const makeRequest = async (method, url, data = null, useAuth = true) => {
  const config = {
    method,
    url: `${API_BASE}${url}`,
    headers: {
      'Content-Type': 'application/json',
      ...(useAuth && customerToken ? { 'Authorization': `Bearer ${customerToken}` } : {})
    },
    withCredentials: true
  };

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.message || error.message,
      status: error.response?.status
    };
  }
};

// Test functions
const test1_CustomerRegistration = async () => {
  console.log('🔹 Test 1: Customer Registration');
  
  const result = await makeRequest('POST', '/customers/register', {
    name: testData.customer.name,
    email: testData.customer.email,
    password: testData.customer.password,
    phone: testData.customer.phone
  }, false);

  if (result.success) {
    console.log('✅ Customer registered successfully');
    return true;
  } else {
    console.log('❌ Registration failed:', result.error);
    return false;
  }
};

const test2_CustomerLogin = async () => {
  console.log('\\n🔹 Test 2: Customer Login');
  
  const result = await makeRequest('POST', '/customers/login', {
    email: testData.customer.email,
    password: testData.customer.password
  }, false);

  if (result.success && result.data.data.token) {
    customerToken = result.data.data.token;
    console.log('✅ Customer logged in successfully');
    console.log('   Token:', customerToken.substring(0, 20) + '...');
    return true;
  } else {
    console.log('❌ Login failed:', result.error);
    return false;
  }
};

const test3_GetProducts = async () => {
  console.log('\\n🔹 Test 3: Get Products');
  
  const result = await makeRequest('GET', '/products', null, false);

  if (result.success && result.data.data.products.length > 0) {
    productId = result.data.data.products[0]._id;
    console.log('✅ Products fetched successfully');
    console.log('   Found', result.data.data.products.length, 'products');
    console.log('   Using product:', result.data.data.products[0].name);
    return true;
  } else {
    console.log('❌ Failed to get products:', result.error);
    return false;
  }
};

const test4_AddToCart = async () => {
  console.log('\\n🔹 Test 4: Add to Cart');
  
  if (!productId) {
    console.log('❌ No product ID available');
    return false;
  }

  const result = await makeRequest('POST', '/cart/add', {
    productId: productId,
    quantity: 2
  });

  if (result.success) {
    console.log('✅ Item added to cart successfully');
    return true;
  } else {
    console.log('❌ Failed to add to cart:', result.error);
    return false;
  }
};

const test5_GetCart = async () => {
  console.log('\\n🔹 Test 5: Get Cart');
  
  const result = await makeRequest('GET', '/cart');

  if (result.success && result.data.data.items.length > 0) {
    cartItemId = result.data.data.items[0].id;
    console.log('✅ Cart fetched successfully');
    console.log('   Items in cart:', result.data.data.items.length);
    console.log('   Total amount: ₹' + result.data.data.totals.total);
    return true;
  } else {
    console.log('❌ Failed to get cart:', result.error);
    return false;
  }
};

const test6_PlaceOrder = async () => {
  console.log('\\n🔹 Test 6: Place Order');
  
  const result = await makeRequest('POST', '/orders', {
    shippingAddress: testData.address,
    paymentMethod: 'online'
  });

  if (result.success && result.data.order) {
    orderId = result.data.order._id;
    paymentId = result.data.payment.paymentId;
    console.log('✅ Order placed successfully');
    console.log('   Order ID:', result.data.order.orderNumber);
    console.log('   Payment ID:', paymentId);
    console.log('   Total: ₹' + result.data.order.total);
    return true;
  } else {
    console.log('❌ Failed to place order:', result.error);
    return false;
  }
};

const test7_ProcessPayment = async () => {
  console.log('\\n🔹 Test 7: Process Payment');
  
  if (!paymentId || !orderId) {
    console.log('❌ Missing payment or order ID');
    return false;
  }

  const result = await makeRequest('POST', '/payments/process', {
    paymentId: paymentId,
    orderId: orderId,
    method: 'CARD'
  });

  if (result.success) {
    console.log('✅ Payment processed successfully');
    console.log('   Payment status:', result.data.payment.status);
    console.log('   Order status:', result.data.order.status);
    return true;
  } else {
    console.log('❌ Payment processing failed:', result.error);
    return false;
  }
};

const test8_GetOrders = async () => {
  console.log('\\n🔹 Test 8: Get Orders');
  
  const result = await makeRequest('GET', '/orders');

  if (result.success && result.data.orders.length > 0) {
    console.log('✅ Orders fetched successfully');
    console.log('   Total orders:', result.data.orders.length);
    console.log('   Latest order status:', result.data.orders[0].status);
    return true;
  } else {
    console.log('❌ Failed to get orders:', result.error);
    return false;
  }
};

const test9_CancelOrder = async () => {
  console.log('\\n🔹 Test 9: Cancel Order');
  
  if (!orderId) {
    console.log('❌ No order ID available');
    return false;
  }

  const result = await makeRequest('PATCH', `/orders/${orderId}/cancel`, {
    reason: 'Testing cancellation flow'
  });

  if (result.success) {
    console.log('✅ Order cancelled successfully');
    console.log('   Cancellation reason:', result.data.order.cancellationReason);
    return true;
  } else {
    console.log('❌ Failed to cancel order:', result.error);
    return false;
  }
};

const test10_GetPaymentHistory = async () => {
  console.log('\\n🔹 Test 10: Get Payment History');
  
  const result = await makeRequest('GET', '/payments');

  if (result.success) {
    console.log('✅ Payment history fetched successfully');
    console.log('   Total payments:', result.data.payments.length);
    if (result.data.payments.length > 0) {
      console.log('   Latest payment status:', result.data.payments[0].status);
    }
    return true;
  } else {
    console.log('❌ Failed to get payment history:', result.error);
    return false;
  }
};

// Main test runner
const runTests = async () => {
  console.log('🚀 Starting E-commerce API Test Suite');
  console.log('=====================================\\n');

  const tests = [
    test1_CustomerRegistration,
    test2_CustomerLogin,
    test3_GetProducts,
    test4_AddToCart,
    test5_GetCart,
    test6_PlaceOrder,
    test7_ProcessPayment,
    test8_GetOrders,
    test9_CancelOrder,
    test10_GetPaymentHistory
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log('❌ Test threw an error:', error.message);
      failed++;
    }
    
    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\\n=====================================');
  console.log('🏁 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('=====================================');

  if (failed === 0) {
    console.log('🎉 All tests passed! E-commerce API is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please check the implementation.');
  }
};

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };