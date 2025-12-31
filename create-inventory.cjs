#!/usr/bin/env node

const mongoose = require('mongoose');
require('dotenv').config();

const { Product } = require('./dist/models/Product.js');
const { Inventory } = require('./dist/models/Inventory.js');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hipro-comm';

const createInventoryRecords = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all products that don't have inventory records
    const products = await Product.find({ isActive: true });
    console.log(`📦 Found ${products.length} products`);

    // Check existing inventory records
    const existingInventory = await Inventory.find({});
    console.log(`📊 Found ${existingInventory.length} existing inventory records`);

    let createdCount = 0;
    for (const product of products) {
      // Check if inventory already exists for this product
      const existingInv = existingInventory.find(inv => 
        inv.product.toString() === product._id.toString()
      );

      if (!existingInv) {
        // Create inventory record with realistic stock levels
        const stock = Math.floor(Math.random() * 50) + 10; // 10-60 items
        
        await Inventory.create({
          product: product._id,
          sku: product.sku,
          quantityAvailable: stock,
          quantityReserved: 0,
          quantityLocked: 0,
          reorderLevel: Math.floor(stock * 0.2), // 20% of stock as reorder level
          maxStockLevel: stock * 2,
          location: {
            warehouse: 'Main Warehouse',
            section: 'A',
            shelf: `A${Math.floor(Math.random() * 20) + 1}`
          },
          supplier: {
            name: 'Tech Components Ltd',
            contact: 'supplier@techcomponents.com',
            leadTime: 7
          },
          lastRestocked: new Date(),
          isActive: true
        });
        
        createdCount++;
        console.log(`✅ Created inventory for: ${product.name} (Stock: ${stock})`);
      } else {
        console.log(`⏭️  Inventory already exists for: ${product.name}`);
      }
    }

    console.log(`\n🎉 Created ${createdCount} new inventory records`);

  } catch (error) {
    console.error('❌ Error creating inventory:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

// Run script if executed directly
if (require.main === module) {
  createInventoryRecords().catch(console.error);
}

module.exports = { createInventoryRecords };