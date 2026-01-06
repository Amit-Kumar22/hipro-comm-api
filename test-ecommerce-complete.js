/**
 * E-Commerce System Test Script
 * 
 * This script tests the complete flow:
 * 1. User Authentication
 * 2. Add products to cart
 * 3. Update cart quantities
 * 4. Proceed to checkout
 * 5. Place order
 * 6. Process payment
 * 7. View orders
 * 8. Cancel order (if applicable)
 * 9. View payment history
 */

const API_BASE_URL = 'http://localhost:8080/api/v1';

// Test configuration
const TEST_CONFIG = {
  customer: {
    email: 'test@example.com',
    password: 'password123',
    name: 'Test Customer',
    phone: '9876543210'
  },
  address: {
    name: 'Test Customer',
    street: '123 Test Street',
    city: 'Test City',
    state: 'Test State',
    pincode: '123456',
    country: 'India',
    phone: '9876543210'
  }
};

class ECommerceTestSuite {
  constructor() {
    this.token = null;
    this.customerId = null;
    this.productId = null;
    this.cartId = null;
    this.orderId = null;
    this.paymentId = null;
  }

  async makeRequest(method, endpoint, data = null, requireAuth = true) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (requireAuth && this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const config = {
      method,
      headers,
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || `HTTP ${response.status}`);
      }

      return result;
    } catch (error) {
      console.error(`❌ ${method} ${endpoint} failed:`, error.message);
      throw error;
    }
  }

  async testCustomerAuth() {
    console.log('\n🧪 Testing Customer Authentication...');
    
    try {
      // Try to register new customer
      try {
        const registerResult = await this.makeRequest('POST', '/customer/auth/register', {
          name: TEST_CONFIG.customer.name,
          email: TEST_CONFIG.customer.email,
          password: TEST_CONFIG.customer.password,
          phone: TEST_CONFIG.customer.phone
        }, false);
        console.log('✅ Customer registration successful');
      } catch (error) {
        // Customer might already exist, try login
        console.log('ℹ️ Registration failed, trying login (customer might already exist)');
      }

      // Login customer
      const loginResult = await this.makeRequest('POST', '/customer/auth/login', {
        email: TEST_CONFIG.customer.email,
        password: TEST_CONFIG.customer.password
      }, false);

      this.token = loginResult.data.token;
      this.customerId = loginResult.data.customer._id;
      
      console.log('✅ Customer login successful');
      console.log(`   Token: ${this.token.substring(0, 20)}...`);
      console.log(`   Customer ID: ${this.customerId}`);

    } catch (error) {
      console.error('❌ Customer authentication failed');
      throw error;
    }
  }

  async testProductRetrieval() {
    console.log('\n🧪 Testing Product Retrieval...');
    
    try {
      const productsResult = await this.makeRequest('GET', '/products?limit=1', null, false);
      
      if (productsResult.data.products && productsResult.data.products.length > 0) {
        this.productId = productsResult.data.products[0]._id;
        console.log('✅ Products retrieved successfully');
        console.log(`   Test Product ID: ${this.productId}`);
        console.log(`   Product Name: ${productsResult.data.products[0].name}`);
        console.log(`   Product Price: ₹${productsResult.data.products[0].price.selling}`);
        return productsResult.data.products[0];
      } else {
        throw new Error('No products found in the system');
      }
    } catch (error) {
      console.error('❌ Product retrieval failed');
      throw error;
    }
  }

  async testCartOperations(product) {
    console.log('\n🧪 Testing Cart Operations...');
    
    try {
      // Add product to cart
      const addToCartResult = await this.makeRequest('POST', '/cart/add', {
        productId: this.productId,
        quantity: 2
      });
      
      console.log('✅ Add to cart successful');
      console.log(`   Items in cart: ${addToCartResult.data.cartItemsCount}`);
      console.log(`   Cart total: ₹${addToCartResult.data.cartTotal}`);

      // Get cart
      const cartResult = await this.makeRequest('GET', '/cart');
      console.log('✅ Get cart successful');
      console.log(`   Cart items: ${cartResult.data.items.length}`);
      console.log(`   Total items: ${cartResult.data.totals.totalItems}`);

      if (cartResult.data.items.length > 0) {
        const cartItemId = cartResult.data.items[0].id;

        // Update cart item quantity
        const updateResult = await this.makeRequest('PUT', `/cart/item/${cartItemId}`, {
          quantity: 3
        });
        console.log('✅ Update cart quantity successful');
        console.log(`   New cart total: ₹${updateResult.data.cartTotal}`);

        // Validate cart before checkout
        const validateResult = await this.makeRequest('POST', '/cart/validate');
        console.log('✅ Cart validation successful');
        console.log(`   Cart is valid: ${validateResult.data.isValid}`);
        
        if (validateResult.data.errors.length > 0) {
          console.log(`   Validation errors: ${validateResult.data.errors.join(', ')}`);
        }

        return cartResult.data;
      }
    } catch (error) {
      console.error('❌ Cart operations failed');
      throw error;
    }
  }

  async testOrderCreation() {
    console.log('\n🧪 Testing Order Creation...');
    
    try {
      const orderResult = await this.makeRequest('POST', '/orders', {
        shippingAddress: TEST_CONFIG.address,
        billingAddress: TEST_CONFIG.address,
        paymentMethod: 'online',
        appliedCoupons: []
      });

      this.orderId = orderResult.data.orderId;
      this.paymentId = orderResult.data.paymentId;

      console.log('✅ Order creation successful');
      console.log(`   Order ID: ${this.orderId}`);
      console.log(`   Order Number: ${orderResult.data.orderNumber}`);
      console.log(`   Payment ID: ${this.paymentId}`);
      console.log(`   Order Total: ₹${orderResult.data.total}`);
      console.log(`   Payment Status: ${orderResult.data.paymentStatus}`);

      return orderResult.data;
    } catch (error) {
      console.error('❌ Order creation failed');
      throw error;
    }
  }

  async testPaymentFlow() {
    console.log('\n🧪 Testing Payment Flow...');
    
    try {
      // Initiate payment
      const initiateResult = await this.makeRequest('POST', '/payments/initiate', {
        orderId: this.orderId,
        paymentMethod: 'CARD'
      });

      console.log('✅ Payment initiation successful');
      console.log(`   Gateway Order ID: ${initiateResult.data.gateway.gateway_order_id}`);
      console.log(`   Amount: ₹${initiateResult.data.amount}`);

      // Simulate successful payment
      const simulateResult = await this.makeRequest('POST', '/payments/simulate/success', {
        paymentId: this.paymentId,
        orderId: this.orderId
      });

      console.log('✅ Payment simulation successful');
      console.log(`   Payment Status: ${simulateResult.data.status}`);
      console.log(`   Order Status: ${simulateResult.data.orderStatus}`);

      return simulateResult.data;
    } catch (error) {
      console.error('❌ Payment flow failed');
      throw error;
    }
  }

  async testOrderRetrieval() {
    console.log('\n🧪 Testing Order Retrieval...');
    
    try {
      // Get all orders
      const ordersResult = await this.makeRequest('GET', '/orders');
      console.log('✅ Orders retrieval successful');
      console.log(`   Total orders: ${ordersResult.data.orders.length}`);

      // Get specific order
      const orderResult = await this.makeRequest('GET', `/orders/${this.orderId}`);
      console.log('✅ Order details retrieval successful');
      console.log(`   Order Status: ${orderResult.data.status}`);
      console.log(`   Payment Status: ${orderResult.data.paymentStatus}`);
      console.log(`   Can Cancel: ${orderResult.data.canCancel}`);

      return orderResult.data;
    } catch (error) {
      console.error('❌ Order retrieval failed');
      throw error;
    }
  }

  async testOrderCancellation() {
    console.log('\n🧪 Testing Order Cancellation...');
    
    try {
      // Only test cancellation if order can be cancelled
      const orderResult = await this.makeRequest('GET', `/orders/${this.orderId}`);
      
      if (orderResult.data.canCancel) {
        const cancelResult = await this.makeRequest('POST', `/orders/${this.orderId}/cancel`, {
          reason: 'Test cancellation - automated testing'
        });

        console.log('✅ Order cancellation successful');
        console.log(`   Order Status: ${cancelResult.data.status}`);
        console.log(`   Payment Status: ${cancelResult.data.paymentStatus}`);
        console.log(`   Cancelled At: ${cancelResult.data.cancelledAt}`);
        console.log(`   Reason: ${cancelResult.data.cancellationReason}`);

        return cancelResult.data;
      } else {
        console.log('ℹ️ Order cannot be cancelled (status does not allow it)');
        return null;
      }
    } catch (error) {
      console.error('❌ Order cancellation failed');
      throw error;
    }
  }

  async testPaymentHistory() {
    console.log('\n🧪 Testing Payment History...');
    
    try {
      const paymentHistoryResult = await this.makeRequest('GET', '/payments/history');
      
      console.log('✅ Payment history retrieval successful');
      console.log(`   Total payments: ${paymentHistoryResult.data.payments.length}`);

      if (paymentHistoryResult.data.payments.length > 0) {
        const payment = paymentHistoryResult.data.payments[0];
        console.log(`   Latest Payment ID: ${payment.paymentId}`);
        console.log(`   Amount: ₹${payment.amount}`);
        console.log(`   Status: ${payment.status}`);
        console.log(`   Method: ${payment.method}`);
      }

      return paymentHistoryResult.data;
    } catch (error) {
      console.error('❌ Payment history retrieval failed');
      throw error;
    }
  }

  async runFullTest() {
    console.log('🚀 Starting E-Commerce System Full Test Suite...');
    console.log('=' .repeat(60));

    try {
      // Run all tests in sequence
      await this.testCustomerAuth();
      const product = await this.testProductRetrieval();
      await this.testCartOperations(product);
      await this.testOrderCreation();
      await this.testPaymentFlow();
      await this.testOrderRetrieval();
      await this.testOrderCancellation();
      await this.testPaymentHistory();

      console.log('\n' + '=' .repeat(60));
      console.log('🎉 ALL TESTS PASSED! E-Commerce system is working correctly!');
      console.log('=' .repeat(60));
      
      console.log('\n📊 Test Summary:');
      console.log(`   Customer ID: ${this.customerId}`);
      console.log(`   Product ID: ${this.productId}`);
      console.log(`   Order ID: ${this.orderId}`);
      console.log(`   Payment ID: ${this.paymentId}`);

    } catch (error) {
      console.log('\n' + '=' .repeat(60));
      console.log('❌ TEST SUITE FAILED!');
      console.log('Error:', error.message);
      console.log('=' .repeat(60));
      throw error;
    }
  }
}

// Export for use in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ECommerceTestSuite;
}

// Run test if this script is executed directly
if (typeof window === 'undefined' && require.main === module) {
  const testSuite = new ECommerceTestSuite();
  testSuite.runFullTest().catch(console.error);
}