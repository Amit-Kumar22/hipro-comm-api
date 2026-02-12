const { MongoClient } = require('mongodb');

const MONGO_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/hipro-comm-db';

async function syncCategoryProducts() {
  const client = new MongoClient(MONGO_URL);
  
  try {
    await client.connect();
    console.log('📡 Connected to MongoDB');
    
    const db = client.db();
    const categoriesCollection = db.collection('categories');
    const productsCollection = db.collection('products');
    
    // First, create the categories
    console.log('\n📂 Creating categories...');
    const categories = [
      {
        name: 'School Robotics Labs',
        slug: 'school-robotics-labs',
        description: 'Complete ATL-compliant robotics lab solutions for educational institutions',
        icon: '🏫',
        isActive: true,
        productCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Home Learning Kits', 
        slug: 'home-learning-kits',
        description: 'DIY robotics and electronics kits perfect for home learning and experimentation',
        icon: '🏠',
        isActive: true,
        productCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'IoT Solutions',
        slug: 'iot-solutions', 
        description: 'Internet of Things development boards, sensors, and connectivity modules',
        icon: '📡',
        isActive: true,
        productCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Components & Parts',
        slug: 'components-parts',
        description: 'High-quality electronic components, sensors, and robotics parts',
        icon: '🔧',
        isActive: true,
        productCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    // Insert categories (skip if they already exist)
    for (const category of categories) {
      const existing = await categoriesCollection.findOne({ slug: category.slug });
      if (!existing) {
        const result = await categoriesCollection.insertOne(category);
        category._id = result.insertedId;
        console.log(`✅ Created category: ${category.name}`);
      } else {
        category._id = existing._id;
        console.log(`📁 Category exists: ${category.name}`);
      }
    }
    
    // Get category IDs for product assignment
    const schoolLabsCategory = categories.find(c => c.slug === 'school-robotics-labs');
    const homeKitsCategory = categories.find(c => c.slug === 'home-learning-kits');
    const iotCategory = categories.find(c => c.slug === 'iot-solutions');
    const componentsCategory = categories.find(c => c.slug === 'components-parts');
    
    // Now create the products with proper categories
    console.log('\n📦 Creating category products...');
    const categoryProducts = [
      // School Robotics Labs Products
      {
        name: 'Complete ATL Robotics Lab Setup (25 Students)',
        slug: 'complete-atl-robotics-lab-setup-25-students',
        description: 'Comprehensive robotics lab with Arduino boards, sensors, tools, and complete curriculum for 25 students. Includes 25 sets of Arduino Uno boards, breadboards, jumper wires, LEDs, resistors, motors, ultrasonic sensors, and a complete project manual with 50+ hands-on activities.',
        shortDescription: 'Comprehensive robotics lab with Arduino boards, sensors, tools, and complete curriculum for 25 students.',
        sku: 'ATL-LAB-25',
        price: {
          original: 150000,
          selling: 125000,
          discount: 17
        },
        images: [
          {
            url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400',
            alt: 'ATL Robotics Lab Setup',
            isPrimary: true
          }
        ],
        category: schoolLabsCategory._id,
        inventory: {
          availableForSale: 5,
          reserved: 2,
          damaged: 0,
          isOutOfStock: false,
          isLowStock: true,
          lastRestockedAt: new Date(),
          notes: 'High-value institutional product'
        },
        specifications: [
          { key: 'Students Capacity', value: '25 Students' },
          { key: 'Arduino Boards', value: '25 Arduino Uno R3' },
          { key: 'Sensors Included', value: '200+ Various Sensors' },
          { key: 'Project Manual', value: '50+ Activities' },
          { key: 'Support', value: 'Teacher Training Included' },
          { key: 'Warranty', value: '2 Years' }
        ],
        isActive: true,
        isFeatured: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Mini ATL Setup (10 Students)',
        slug: 'mini-atl-setup-10-students',
        description: 'Compact robotics lab solution perfect for smaller classrooms and pilot programs. Includes 10 complete Arduino starter kits with essential sensors and components.',
        shortDescription: 'Compact robotics lab solution perfect for smaller classrooms and pilot programs.',
        sku: 'MINI-ATL-10',
        price: {
          original: 75000,
          selling: 65000,
          discount: 13
        },
        images: [
          {
            url: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400',
            alt: 'Mini ATL Setup',
            isPrimary: true
          }
        ],
        category: schoolLabsCategory._id,
        inventory: {
          availableForSale: 8,
          reserved: 1,
          damaged: 0,
          isOutOfStock: false,
          isLowStock: true,
          lastRestockedAt: new Date(),
          notes: 'Popular starter lab solution'
        },
        specifications: [
          { key: 'Students Capacity', value: '10 Students' },
          { key: 'Arduino Boards', value: '10 Arduino Uno R3' },
          { key: 'Sensors Included', value: '80+ Various Sensors' },
          { key: 'Project Manual', value: '25+ Activities' },
          { key: 'Support', value: 'Online Training' },
          { key: 'Warranty', value: '1 Year' }
        ],
        isActive: true,
        isFeatured: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Advanced Robotics Lab (30 Students)', 
        slug: 'advanced-robotics-lab-30-students',
        description: 'Premium lab setup with IoT integration, AI modules, and advanced automation components. Perfect for advanced STEM programs and technical institutions.',
        shortDescription: 'Premium lab setup with IoT integration, AI modules, and advanced automation components.',
        sku: 'ADV-LAB-30',
        price: {
          original: 225000,
          selling: 185000,
          discount: 18
        },
        images: [
          {
            url: 'https://images.unsplash.com/photo-1553862407-820ea10cf263?w=400',
            alt: 'Advanced Robotics Lab',
            isPrimary: true
          }
        ],
        category: schoolLabsCategory._id,
        inventory: {
          availableForSale: 3,
          reserved: 1,
          damaged: 0,
          isOutOfStock: false,
          isLowStock: true,
          lastRestockedAt: new Date(),
          notes: 'Premium institutional solution'
        },
        specifications: [
          { key: 'Students Capacity', value: '30 Students' },
          { key: 'Arduino & RPi', value: '30 Arduino + 15 Raspberry Pi' },
          { key: 'IoT Modules', value: 'WiFi, Bluetooth, LoRa' },
          { key: 'AI Components', value: 'Machine Learning Modules' },
          { key: 'Support', value: 'On-site Training' },
          { key: 'Warranty', value: '3 Years' }
        ],
        isActive: true,
        isFeatured: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      
      // Home Learning Kits Products
      {
        name: 'Advanced Arduino Learning Kit',
        slug: 'advanced-arduino-learning-kit',
        description: 'Professional-grade Arduino kit with 40+ sensors and comprehensive project guide. Perfect for students and hobbyists who want to master Arduino programming and electronics.',
        shortDescription: 'Professional-grade Arduino kit with 40+ sensors and comprehensive project guide.',
        sku: 'ARD-KIT-ADV',
        price: {
          original: 5500,
          selling: 4500,
          discount: 18
        },
        images: [
          {
            url: 'https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?w=400',
            alt: 'Advanced Arduino Learning Kit',
            isPrimary: true
          }
        ],
        category: homeKitsCategory._id,
        inventory: {
          availableForSale: 25,
          reserved: 3,
          damaged: 0,
          isOutOfStock: false,
          isLowStock: false,
          lastRestockedAt: new Date(),
          notes: 'Best-selling learning kit'
        },
        specifications: [
          { key: 'Board', value: 'Arduino Uno R3 Compatible' },
          { key: 'Sensors', value: '40+ Different Sensors' },
          { key: 'Components', value: '200+ Electronic Components' },
          { key: 'Projects', value: '30+ Step-by-step Projects' },
          { key: 'Support', value: 'Online Tutorials & Community' },
          { key: 'Skill Level', value: 'Intermediate to Advanced' }
        ],
        isActive: true,
        isFeatured: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Basic Electronics Learning Kit',
        slug: 'basic-electronics-learning-kit',
        description: 'Perfect starter kit with breadboard, LEDs, resistors, and beginner-friendly components. Ideal for students just beginning their electronics journey.',
        shortDescription: 'Perfect starter kit with breadboard, LEDs, resistors, and beginner-friendly components.',
        sku: 'ELEC-KIT-BASIC',
        price: {
          original: 3000,
          selling: 2500,
          discount: 17
        },
        images: [
          {
            url: 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?w=400',
            alt: 'Basic Electronics Learning Kit',
            isPrimary: true
          }
        ],
        category: homeKitsCategory._id,
        inventory: {
          availableForSale: 40,
          reserved: 5,
          damaged: 0,
          isOutOfStock: false,
          isLowStock: false,
          lastRestockedAt: new Date(),
          notes: 'Great for beginners'
        },
        specifications: [
          { key: 'Breadboard', value: 'Half-size Breadboard' },
          { key: 'LEDs', value: '20+ Various Colors' },
          { key: 'Resistors', value: '100+ Different Values' },
          { key: 'Projects', value: '15+ Beginner Projects' },
          { key: 'Manual', value: 'Step-by-step Guide' },
          { key: 'Skill Level', value: 'Beginner' }
        ],
        isActive: true,
        isFeatured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Robotics Explorer Kit',
        slug: 'robotics-explorer-kit',
        description: 'Build your first robot with motors, sensors, and easy-to-follow instructions. Perfect introduction to robotics for students and makers.',
        shortDescription: 'Build your first robot with motors, sensors, and easy-to-follow instructions.',
        sku: 'ROBOT-KIT-EXP',
        price: {
          original: 4500,
          selling: 3800,
          discount: 16
        },
        images: [
          {
            url: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=400',
            alt: 'Robotics Explorer Kit',
            isPrimary: true
          }
        ],
        category: homeKitsCategory._id,
        inventory: {
          availableForSale: 30,
          reserved: 2,
          damaged: 0,
          isOutOfStock: false,
          isLowStock: false,
          lastRestockedAt: new Date(),
          notes: 'New product - gaining popularity'
        },
        specifications: [
          { key: 'Motors', value: '2 Servo Motors + 2 DC Motors' },
          { key: 'Sensors', value: 'Ultrasonic, Light, Touch' },
          { key: 'Controller', value: 'Arduino Compatible Board' },
          { key: 'Projects', value: '10+ Robot Building Projects' },
          { key: 'Assembly', value: 'Tool-free Assembly' },
          { key: 'Age Group', value: '12+ Years' }
        ],
        isActive: true,
        isFeatured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    // Insert products
    let insertedCount = 0;
    for (const product of categoryProducts) {
      const existing = await productsCollection.findOne({ sku: product.sku });
      if (!existing) {
        await productsCollection.insertOne(product);
        insertedCount++;
        console.log(`✅ Added product: ${product.name}`);
      } else {
        console.log(`📦 Product exists: ${product.name}`);
      }
    }
    
    // Update category product counts
    console.log('\n📊 Updating category product counts...');
    for (const category of categories) {
      const productCount = await productsCollection.countDocuments({ category: category._id });
      await categoriesCollection.updateOne(
        { _id: category._id },
        { $set: { productCount: productCount, updatedAt: new Date() } }
      );
      console.log(`📈 ${category.name}: ${productCount} products`);
    }
    
    console.log(`\n🎉 Successfully added ${insertedCount} new products to the database!`);
    console.log('\n💡 Now these products will appear on:');
    console.log('   ✅ Main Products page (/products)');
    console.log('   ✅ School Labs category (/category/school-robotics-labs)');
    console.log('   ✅ Home Kits category (/category/home-learning-kits)');
    console.log('   ✅ Search results and filters');
    
  } catch (error) {
    console.error('❌ Error syncing category products:', error);
  } finally {
    await client.close();
    console.log('\n📡 Database connection closed');
  }
}

syncCategoryProducts().catch(console.error);