#!/usr/bin/env node

/**
 * Test Payment Verify Route
 * This script tests the payment verification route directly
 */

const http = require('http');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testPaymentVerifyRoute() {
  console.log('🧪 Testing Payment Verify Route');
  console.log('='.repeat(50));

  try {
    // Test 1: Basic POST request to payment/verify
    console.log('📡 Testing /api/v1/payment/verify route...');
    
    const form = new FormData();
    form.append('orderId', 'test-order-123');
    form.append('transactionId', 'test-txn-123456789');
    form.append('amount', '1000');
    form.append('paymentMethod', 'bank_transfer');
    
    // Create a dummy image file for testing
    const testImagePath = path.join(__dirname, 'test-image.jpg');
    if (!fs.existsSync(testImagePath)) {
      // Create a minimal test file
      fs.writeFileSync(testImagePath, Buffer.from('dummy image content'));
    }
    form.append('screenshot', fs.createReadStream(testImagePath));

    const options = {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/payment/verify',
      method: 'POST',
      headers: form.getHeaders()
    };

    const req = http.request(options, (res) => {
      console.log(`✅ Response Status: ${res.statusCode}`);
      console.log(`✅ Response Headers:`, res.headers);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          console.log('✅ Response Data:', JSON.stringify(jsonData, null, 2));
          
          if (res.statusCode === 404) {
            console.log('❌ Route not found - Check route registration');
          } else if (res.statusCode >= 400) {
            console.log('⚠️  Route exists but returned error');
          } else {
            console.log('🎉 Route is working correctly!');
          }
        } catch (e) {
          console.log('✅ Response (text):', data);
        }
        
        // Cleanup
        if (fs.existsSync(testImagePath)) {
          fs.unlinkSync(testImagePath);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      
      if (error.code === 'ECONNREFUSED') {
        console.log('💡 Backend API server is not running on port 5000');
      }
      
      // Cleanup
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    });

    form.pipe(req);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Test 2: Check if uploads directory exists
function checkUploadsDirectory() {
  console.log('\n📁 Checking uploads directory...');
  
  const uploadsPath = path.join(__dirname, 'uploads');
  const paymentProofsPath = path.join(uploadsPath, 'payment-proofs');
  
  if (!fs.existsSync(uploadsPath)) {
    console.log('❌ uploads directory does not exist');
    console.log('💡 Creating uploads directory...');
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
  
  if (!fs.existsSync(paymentProofsPath)) {
    console.log('❌ payment-proofs directory does not exist');
    console.log('💡 Creating payment-proofs directory...');
    fs.mkdirSync(paymentProofsPath, { recursive: true });
  }
  
  // Check write permissions
  try {
    const testFile = path.join(paymentProofsPath, 'test-write.txt');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log('✅ uploads/payment-proofs directory is writable');
  } catch (error) {
    console.log('❌ uploads/payment-proofs directory is not writable:', error.message);
  }
}

// Run tests
console.log('🏗️  Setting up test environment...');
checkUploadsDirectory();
setTimeout(testPaymentVerifyRoute, 1000);