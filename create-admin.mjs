// Simple script to create an admin user
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Connect to MongoDB
await mongoose.connect('mongodb://localhost:27017/hiprotech-comm');

// User Schema (simplified)
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' }
});

const User = mongoose.model('User', UserSchema);

// Create admin user
const adminData = {
  name: 'Admin User',
  email: 'admin@hiprotech.org',
  password: 'admin123',
  role: 'admin'
};

// Hash password
const salt = await bcrypt.genSalt(10);
adminData.password = await bcrypt.hash(adminData.password, salt);

// Check if admin already exists
const existingAdmin = await User.findOne({ email: adminData.email });

if (existingAdmin) {
  console.log('✅ Admin user already exists:', adminData.email);
} else {
  // Create admin user
  const adminUser = await User.create(adminData);
  console.log('✅ Admin user created successfully!');
  console.log('Email:', adminData.email);
  console.log('Password: admin123');
}

await mongoose.connection.close();
console.log('🔌 Database connection closed');