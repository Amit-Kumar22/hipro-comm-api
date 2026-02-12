#!/usr/bin/env node

/**
 * Database Migration Script
 * Migrates all data from old database names to hipro-comm-db
 */

const { MongoClient } = require('mongodb');

const OLD_DB_NAMES = [
  'hipro-ecommerce',
  'hiprotech',
  'hiprotech-ecommerce',
  'ecommerce',
  'hipro-comm'
];

const MAIN_DB_URL = 'mongodb://localhost:27017/hipro-comm-db';

async function migrateDatabase() {
  console.log('🔄 Starting database migration to hipro-comm-db...');
  console.log('=====================================\n');
  
  const mainClient = new MongoClient(MAIN_DB_URL);
  await mainClient.connect();
  const mainDb = mainClient.db();
  
  console.log('✅ Connected to main database: hipro-comm-db\n');
  
  for (const oldDbName of OLD_DB_NAMES) {
    try {
      const oldDbUrl = `mongodb://localhost:27017/${oldDbName}`;
      const oldClient = new MongoClient(oldDbUrl);
      await oldClient.connect();
      
      const oldDb = oldClient.db();
      const collections = await oldDb.listCollections().toArray();
      
      if (collections.length > 0) {
        console.log(`📦 Found data in database: ${oldDbName}`);
        console.log(`   Collections: ${collections.map(c => c.name).join(', ')}`);
        
        for (const collection of collections) {
          const collectionName = collection.name;
          const data = await oldDb.collection(collectionName).find({}).toArray();
          
          if (data.length > 0) {
            console.log(`   📋 Migrating ${data.length} documents from ${collectionName}...`);
            
            // Check if collection already exists in main db
            const existingData = await mainDb.collection(collectionName).find({}).toArray();
            
            if (existingData.length === 0) {
              // Insert all data if collection is empty
              await mainDb.collection(collectionName).insertMany(data);
              console.log(`   ✅ Inserted ${data.length} documents into ${collectionName}`);
            } else {
              // Merge data carefully to avoid duplicates
              let insertedCount = 0;
              for (const doc of data) {
                try {
                  const existing = await mainDb.collection(collectionName).findOne({ _id: doc._id });
                  if (!existing) {
                    await mainDb.collection(collectionName).insertOne(doc);
                    insertedCount++;
                  }
                } catch (error) {
                  // Skip documents that cause conflicts
                  console.log(`   ⚠️ Skipped duplicate document in ${collectionName}`);
                }
              }
              console.log(`   ✅ Merged ${insertedCount} new documents into ${collectionName}`);
            }
          }
        }
        console.log(`✅ Migration completed for ${oldDbName}\n`);
      } else {
        console.log(`⚪ Database ${oldDbName} is empty or doesn't exist\n`);
      }
      
      await oldClient.close();
    } catch (error) {
      console.log(`❌ Could not access database: ${oldDbName} (${error.message})\n`);
    }
  }
  
  // Show final statistics
  const finalCollections = await mainDb.listCollections().toArray();
  console.log('📊 MIGRATION SUMMARY');
  console.log('====================');
  console.log(`Main database: hipro-comm-db`);
  console.log(`Total collections: ${finalCollections.length}`);
  
  for (const collection of finalCollections) {
    const count = await mainDb.collection(collection.name).countDocuments();
    console.log(`  - ${collection.name}: ${count} documents`);
  }
  
  await mainClient.close();
  console.log('\n🎉 Database migration completed successfully!');
  console.log('\n💡 You can now safely remove old databases if they exist:');
  OLD_DB_NAMES.forEach(dbName => {
    console.log(`   mongo --eval "db.dropDatabase()" ${dbName}`);
  });
}

// Run migration
migrateDatabase().catch(console.error);