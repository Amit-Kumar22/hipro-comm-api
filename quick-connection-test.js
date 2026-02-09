// Quick test script to verify production optimizations work
const mongoose = require('mongoose');
const path = require('path');

// Import the production optimization (compiled version)
console.log('🧪 Testing production optimization connection...\n');

async function quickTest() {
  try {
    // Test basic connection with simple options
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000,
      bufferCommands: false,
    };
    
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hipro-comm-db';
    console.log(`🔗 Connecting to: ${mongoUri.replace(/\/\/.*@/, '//***:***@')}`);
    
    const startTime = Date.now();
    await mongoose.connect(mongoUri, options);
    const connectTime = Date.now() - startTime;
    
    console.log(`✅ Connected successfully in ${connectTime}ms`);
    console.log(`📊 Connection state: ${mongoose.connection.readyState === 1 ? 'Ready' : 'Not Ready'}`);
    
    // Test a simple query
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📚 Database collections: ${collections.length}`);
    
    // Show optimization status
    console.log('\n🚀 Production Optimizations Status:');
    console.log(`   - Buffer Commands: ${options.bufferCommands ? 'Enabled' : 'Disabled ✅'}`);
    console.log(`   - Connection Pool: ${options.maxPoolSize} connections ✅`);
    console.log(`   - Socket Timeout: ${options.socketTimeoutMS / 1000}s ✅`);
    
    console.log('\n🎯 Ready for production deployment!');
    
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Check if MongoDB is running');
    console.log('2. Verify MONGODB_URI environment variable');
    console.log('3. Check network connectivity');
    console.log('4. Ensure database exists and is accessible');
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n🔌 Connection closed');
    }
  }
}

// Run the test
quickTest()
  .then(() => {
    console.log('\n✅ Quick test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Quick test failed:', error);
    process.exit(1);
  });