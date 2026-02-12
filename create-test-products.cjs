#!/usr/bin/env node

const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

// MongoDB connection
const MONGO_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/hipro-comm-db';

async function createTestProducts() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('📡 Connected to MongoDB');
    
    const db = client.db();
    const productsCollection = db.collection('products');
    const categoriesCollection = db.collection('categories');
    const inventoryCollection = db.collection('inventories');
    
    // Clear existing data
    await productsCollection.deleteMany({});
    await categoriesCollection.deleteMany({});
    await inventoryCollection.deleteMany({});
    
    console.log('🗑️ Cleared existing products, categories and inventory');

    // Create categories first
    const schoolRoboticsCategory = await categoriesCollection.insertOne({
      name: 'School Robotics Labs',
      slug: 'school-robotics-labs',
      description: 'Educational robotics kits and equipment for schools',
      image: 'https://example.com/school-robotics.jpg',
      isActive: true,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const homeLearningCategory = await categoriesCollection.insertOne({
      name: 'Home Learning Kits',
      slug: 'home-learning-kits', 
      description: 'Learning kits for home education and skill development',
      image: 'https://example.com/home-learning.jpg',
      isActive: true,
      sortOrder: 2,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ Created categories');

    // Create School Robotics Labs product
    const schoolRoboticsProduct = {
      name: 'Advanced School Robotics Kit Pro',
      slug: 'advanced-school-robotics-kit-pro',
      description: 'Complete robotics education package for schools with advanced programming capabilities, sensors, and building components. Perfect for STEM education and coding classes.',
      shortDescription: 'Professional robotics kit for school education with programming and sensors',
      sku: 'SRL-ASRK-001',
      category: schoolRoboticsCategory.insertedId,
      images: [
        {
          url: 'https://example.com/robotics-kit-1.jpg',
          alt: 'School Robotics Kit Main Image',
          isPrimary: true
        }
      ],
      price: {
        original: 15000,
        selling: 12000,
        discount: 20
      },
      specifications: [
        { key: 'Components', value: '50+ sensors and actuators' },
        { key: 'Programming', value: 'Block-based and text coding' },
        { key: 'Age Group', value: '10-18 years' },
        { key: 'Students', value: '4-6 students per kit' }
      ],
      dimensions: {
        length: 40,
        width: 30,
        height: 15,
        weight: 2.5,
        unit: 'cm',
        weightUnit: 'kg'
      },
      stock: {
        quantity: 102,
        reserved: 0,
        available: 102
      },
      tags: ['robotics', 'education', 'STEM', 'programming'],
      isActive: true,
      isFeatured: true,
      inStock: true,
      ratings: {
        average: 4.8,
        count: 45
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Create Home Learning Kits product
    const homeLearningProduct = {
      name: 'Complete Home Learning STEM Kit',
      slug: 'complete-home-learning-stem-kit',
      description: 'Comprehensive learning kit for home education covering science, technology, engineering and math. Includes experiment guides, materials, and online resources for self-paced learning.',
      shortDescription: 'All-in-one STEM learning kit for home education and experiments',
      sku: 'HLK-CHLS-002',
      category: homeLearningCategory.insertedId,
      images: [
        {
          url: 'https://example.com/home-learning-kit-1.jpg',
          alt: 'Home Learning Kit Main Image',
          isPrimary: true
        }
      ],
      price: {
        original: 8000,
        selling: 6500,
        discount: 19
      },
      specifications: [
        { key: 'Experiments', value: '25+ guided experiments' },
        { key: 'Materials', value: 'Lab-grade components included' },
        { key: 'Age Group', value: '8-16 years' },
        { key: 'Duration', value: '6 months of learning content' }
      ],
      dimensions: {
        length: 35,
        width: 25,
        height: 12,
        weight: 1.8,
        unit: 'cm',
        weightUnit: 'kg'
      },
      stock: {
        quantity: 100,
        reserved: 0,
        available: 100
      },
      tags: ['STEM', 'education', 'experiments', 'home-learning'],
      isActive: true,
      isFeatured: true,
      inStock: true,
      ratings: {
        average: 4.6,
        count: 32
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Insert products
    const schoolProduct = await productsCollection.insertOne(schoolRoboticsProduct);
    const homeProduct = await productsCollection.insertOne(homeLearningProduct);

    // Create corresponding inventory records
    await inventoryCollection.insertOne({
      product: schoolProduct.insertedId,
      sku: schoolRoboticsProduct.sku,
      quantityAvailable: 102,
      quantityReserved: 0,
      quantityLocked: 0,
      reorderLevel: 10,
      maxStockLevel: 200,
      location: {
        warehouse: 'Main Warehouse',
        section: 'A',
        shelf: '1'
      },
      supplier: {
        name: 'Educational Robotics Supply Co.',
        contact: 'orders@roboticsedu.com',
        leadTime: 7
      },
      lastRestocked: new Date(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await inventoryCollection.insertOne({
      product: homeProduct.insertedId,
      sku: homeLearningProduct.sku,
      quantityAvailable: 100,
      quantityReserved: 0,
      quantityLocked: 0,
      reorderLevel: 15,
      maxStockLevel: 150,
      location: {
        warehouse: 'Main Warehouse',
        section: 'B',
        shelf: '2'
      },
      supplier: {
        name: 'STEM Education Materials Ltd.',
        contact: 'supply@stemedu.com',
        leadTime: 5
      },
      lastRestocked: new Date(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('\n🎉 Test products created successfully!');
    console.log('\n📦 Products:');
    console.log(`  ✅ ${schoolRoboticsProduct.name} - Stock: ${schoolRoboticsProduct.stock.available} available`);
    console.log(`  ✅ ${homeLearningProduct.name} - Stock: ${homeLearningProduct.stock.available} available`);
    
    console.log('\n🏷️ Categories:');
    console.log('  ✅ School Robotics Labs');
    console.log('  ✅ Home Learning Kits');
    
    console.log('\n📊 Inventory records created for both products');
    console.log('\n💡 Now you can test the "Add to Cart" functionality!');

  } catch (error) {
    console.error('❌ Error creating test products:', error);
  } finally {
    await client.close();
    console.log('📡 Database connection closed');
  }
}

// Run the script
createTestProducts().catch(console.error);