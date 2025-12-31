#!/usr/bin/env node

/**
 * Sample Data Script for E-commerce API
 * Creates sample products, categories for testing
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const { Product } = require('./dist/models/Product.js');
const { Category } = require('./dist/models/Category.js');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hipro-comm';

// Sample categories
const sampleCategories = [
  {
    name: 'Electronics',
    slug: 'electronics',
    description: 'Electronic devices and accessories',
    isActive: true
  },
  {
    name: 'Clothing',
    slug: 'clothing', 
    description: 'Fashion and apparel',
    isActive: true
  },
  {
    name: 'Books',
    slug: 'books',
    description: 'Books and literature',
    isActive: true
  }
];

// Sample products
const sampleProducts = [
  {
    name: 'Smartphone Pro Max',
    slug: 'smartphone-pro-max',
    description: 'Latest flagship smartphone with advanced camera and performance features. Perfect for photography enthusiasts and power users.',
    shortDescription: 'Flagship smartphone with advanced features',
    sku: 'PHONE-001',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500',
        alt: 'Smartphone Pro Max',
        isPrimary: true
      }
    ],
    price: {
      original: 79999,
      selling: 74999
    },
    stock: {
      quantity: 50,
      reserved: 0,
      available: 50
    },
    specifications: [
      { key: 'Display', value: '6.7" OLED' },
      { key: 'Storage', value: '256GB' },
      { key: 'RAM', value: '8GB' },
      { key: 'Battery', value: '4500mAh' }
    ],
    dimensions: {
      length: 16,
      width: 8,
      height: 0.8,
      weight: 200,
      unit: 'cm',
      weightUnit: 'kg'
    },
    isActive: true,
    isFeatured: true,
    inStock: true,
    tags: ['smartphone', 'electronics', 'mobile']
  },
  {
    name: 'Wireless Bluetooth Headphones',
    slug: 'wireless-bluetooth-headphones',
    description: 'Premium noise-canceling wireless headphones with exceptional sound quality and long battery life.',
    shortDescription: 'Premium wireless headphones with noise cancellation',
    sku: 'AUDIO-002',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
        alt: 'Wireless Headphones',
        isPrimary: true
      }
    ],
    price: {
      original: 12999,
      selling: 9999
    },
    stock: {
      quantity: 75,
      reserved: 0,
      available: 75
    },
    specifications: [
      { key: 'Type', value: 'Over-ear' },
      { key: 'Connectivity', value: 'Bluetooth 5.0' },
      { key: 'Battery Life', value: '30 hours' },
      { key: 'Noise Cancellation', value: 'Active' }
    ],
    dimensions: {
      length: 20,
      width: 18,
      height: 8,
      weight: 300,
      unit: 'cm',
      weightUnit: 'kg'
    },
    isActive: true,
    isFeatured: true,
    inStock: true,
    tags: ['headphones', 'audio', 'wireless']
  },
  {
    name: 'Cotton T-Shirt',
    slug: 'cotton-t-shirt',
    description: 'Comfortable 100% cotton t-shirt available in multiple colors and sizes. Perfect for casual wear.',
    shortDescription: '100% cotton comfortable t-shirt',
    sku: 'CLOTH-003',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500',
        alt: 'Cotton T-Shirt',
        isPrimary: true
      }
    ],
    price: {
      original: 999,
      selling: 799
    },
    stock: {
      quantity: 100,
      reserved: 0,
      available: 100
    },
    variants: [
      {
        name: 'Size',
        options: [
          { name: 'Small', value: 'S', priceAdjustment: 0, sku: 'CLOTH-003-S' },
          { name: 'Medium', value: 'M', priceAdjustment: 0, sku: 'CLOTH-003-M' },
          { name: 'Large', value: 'L', priceAdjustment: 0, sku: 'CLOTH-003-L' },
          { name: 'Extra Large', value: 'XL', priceAdjustment: 50, sku: 'CLOTH-003-XL' }
        ]
      },
      {
        name: 'Color',
        options: [
          { name: 'Black', value: 'black', priceAdjustment: 0, sku: 'CLOTH-003-BLACK' },
          { name: 'White', value: 'white', priceAdjustment: 0, sku: 'CLOTH-003-WHITE' },
          { name: 'Blue', value: 'blue', priceAdjustment: 0, sku: 'CLOTH-003-BLUE' }
        ]
      }
    ],
    specifications: [
      { key: 'Material', value: '100% Cotton' },
      { key: 'Fit', value: 'Regular' },
      { key: 'Care', value: 'Machine wash cold' }
    ],
    dimensions: {
      length: 70,
      width: 50,
      height: 1,
      weight: 200,
      unit: 'cm',
      weightUnit: 'kg'
    },
    isActive: true,
    isFeatured: false,
    inStock: true,
    tags: ['clothing', 'tshirt', 'cotton']
  },
  {
    name: 'Programming Fundamentals Book',
    slug: 'programming-fundamentals-book',
    description: 'Comprehensive guide to programming fundamentals covering algorithms, data structures, and best practices.',
    shortDescription: 'Complete programming fundamentals guide',
    sku: 'BOOK-004',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500',
        alt: 'Programming Book',
        isPrimary: true
      }
    ],
    price: {
      original: 1299,
      selling: 999
    },
    stock: {
      quantity: 30,
      reserved: 0,
      available: 30
    },
    specifications: [
      { key: 'Pages', value: '450' },
      { key: 'Language', value: 'English' },
      { key: 'Publisher', value: 'Tech Publications' },
      { key: 'Edition', value: '3rd Edition' }
    ],
    dimensions: {
      length: 24,
      width: 18,
      height: 3,
      weight: 600,
      unit: 'cm',
      weightUnit: 'kg'
    },
    isActive: true,
    isFeatured: false,
    inStock: true,
    tags: ['book', 'programming', 'education']
  },
  {
    name: 'Laptop Backpack',
    slug: 'laptop-backpack',
    description: 'Durable laptop backpack with multiple compartments, water-resistant material, and ergonomic design.',
    shortDescription: 'Durable laptop backpack with multiple compartments',
    sku: 'BAG-005',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500',
        alt: 'Laptop Backpack',
        isPrimary: true
      }
    ],
    price: {
      original: 2999,
      selling: 2499
    },
    stock: {
      quantity: 40,
      reserved: 0,
      available: 40
    },
    specifications: [
      { key: 'Capacity', value: '25 Liters' },
      { key: 'Material', value: 'Water-resistant nylon' },
      { key: 'Laptop Size', value: 'Up to 15.6 inches' },
      { key: 'Warranty', value: '2 years' }
    ],
    dimensions: {
      length: 45,
      width: 30,
      height: 20,
      weight: 800,
      unit: 'cm',
      weightUnit: 'kg'
    },
    isActive: true,
    isFeatured: true,
    inStock: true,
    tags: ['backpack', 'laptop', 'travel']
  }
];

const createSampleData = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data (optional)
    console.log('🗑️  Clearing existing data...');
    await Product.deleteMany({});
    await Category.deleteMany({});

    // Create categories
    console.log('📂 Creating categories...');
    const categories = await Category.insertMany(sampleCategories);
    console.log(`✅ Created ${categories.length} categories`);

    // Assign category IDs to products
    console.log('📦 Creating products...');
    const productsWithCategories = sampleProducts.map((product, index) => ({
      ...product,
      category: categories[index % categories.length]._id
    }));

    const products = await Product.insertMany(productsWithCategories);
    console.log(`✅ Created ${products.length} products`);

    console.log('\\n🎉 Sample data created successfully!');
    console.log('\\nCreated Categories:');
    categories.forEach(cat => {
      console.log(`  - ${cat.name} (${cat.slug})`);
    });

    console.log('\\nCreated Products:');
    products.forEach(product => {
      console.log(`  - ${product.name} (₹${product.price.selling}) - Stock: ${product.stock.quantity}`);
    });

  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\\n🔌 Disconnected from MongoDB');
  }
};

// Run script if executed directly
if (require.main === module) {
  createSampleData().catch(console.error);
}

module.exports = { createSampleData };