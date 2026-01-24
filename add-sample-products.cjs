const { MongoClient } = require('mongodb');

const MONGO_URL = 'mongodb://localhost:27017/hipro-ecommerce';

async function addSampleProducts() {
  const client = new MongoClient(MONGO_URL);
  
  try {
    await client.connect();
    console.log('📡 Connected to MongoDB');
    
    const db = client.db();
    const productsCollection = db.collection('products');
    
    // Create sample products with proper inventory
    const sampleProducts = [
      {
        name: "HiPro Gaming Laptop RTX 4060",
        slug: "hipro-gaming-laptop-rtx-4060", 
        description: "High-performance gaming laptop featuring NVIDIA RTX 4060 graphics card, Intel i7 processor, 16GB RAM, and 512GB NVMe SSD. Perfect for gaming, development, and content creation.",
        shortDescription: "Powerful gaming laptop with RTX 4060 graphics and i7 processor",
        sku: "HIPRO-LAPTOP-001",
        price: {
          original: 85000,
          selling: 75000,
          discount: 12
        },
        images: [
          {
            url: "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=400",  
            alt: "Gaming Laptop",
            isPrimary: true
          }
        ],
        inventory: {
          availableForSale: 15,
          reserved: 2,
          damaged: 0,
          isOutOfStock: false,
          isLowStock: false,
          lastRestockedAt: new Date(),
          notes: "Popular gaming laptop model"
        },
        isActive: true,
        isFeatured: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "HiPro Wireless Gaming Mouse RGB",
        slug: "hipro-wireless-gaming-mouse-rgb",
        description: "Ergonomic wireless gaming mouse with customizable RGB lighting, 12000 DPI sensor, and programmable buttons. Long-lasting battery with wireless charging support.",
        shortDescription: "RGB wireless gaming mouse with 12000 DPI precision",
        sku: "HIPRO-MOUSE-001", 
        price: {
          original: 4500,
          selling: 3200,
          discount: 29
        },
        images: [
          {
            url: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400",
            alt: "Gaming Mouse",
            isPrimary: true
          }
        ],
        inventory: {
          availableForSale: 35,
          reserved: 5,
          damaged: 0,
          isOutOfStock: false,
          isLowStock: false,
          lastRestockedAt: new Date(),
          notes: "Best seller - good stock levels"
        },
        isActive: true,
        isFeatured: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "HiPro Mechanical Keyboard Cherry MX",
        slug: "hipro-mechanical-keyboard-cherry-mx",
        description: "Premium mechanical keyboard with authentic Cherry MX Blue switches, RGB per-key lighting, and aluminum frame. Features programmable macros and dedicated media controls.",
        shortDescription: "Mechanical keyboard with Cherry MX switches and RGB lighting",
        sku: "HIPRO-KB-001",
        price: {
          original: 9500,
          selling: 7200,
          discount: 24
        },
        images: [
          {
            url: "https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=400",
            alt: "Mechanical Keyboard", 
            isPrimary: true
          }
        ],
        inventory: {
          availableForSale: 8,  // Low stock to test the UI
          reserved: 1,
          damaged: 0,
          isOutOfStock: false,
          isLowStock: true,
          lastRestockedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
          notes: "Low stock - reorder needed"
        },
        isActive: true,
        isFeatured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "HiPro 4K Webcam Pro",
        slug: "hipro-4k-webcam-pro",
        description: "Professional 4K webcam with auto-focus, noise-cancelling microphone, and wide-angle lens. Perfect for streaming, video calls, and content creation.",
        shortDescription: "4K webcam with auto-focus and noise-cancelling microphone",
        sku: "HIPRO-CAM-001",
        price: {
          original: 12000,
          selling: 9500,
          discount: 21
        },
        images: [
          {
            url: "https://images.unsplash.com/photo-1707833558984-3293e794031c?w=400",
            alt: "4K Webcam",
            isPrimary: true
          }
        ],
        inventory: {
          availableForSale: 0,  // Out of stock to test the UI
          reserved: 0,
          damaged: 2,
          isOutOfStock: true,
          isLowStock: false,
          lastRestockedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          notes: "Out of stock - waiting for shipment"
        },
        isActive: true,
        isFeatured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "HiPro USB-C Hub Multi-Port",
        slug: "hipro-usb-c-hub-multi-port",
        description: "7-in-1 USB-C hub with HDMI 4K output, USB 3.0 ports, SD card reader, and 100W power delivery. Compatible with MacBook, laptops, and tablets.",
        shortDescription: "7-in-1 USB-C hub with 4K HDMI and power delivery",
        sku: "HIPRO-HUB-001",
        price: {
          original: 3500,
          selling: 2500,
          discount: 29
        },
        images: [
          {
            url: "https://images.unsplash.com/photo-1625842268584-8f3296236761?w=400",
            alt: "USB-C Hub",
            isPrimary: true
          }
        ],
        inventory: {
          availableForSale: 50,
          reserved: 0,
          damaged: 0,
          isOutOfStock: false,
          isLowStock: false,
          lastRestockedAt: new Date(),
          notes: "New product launch - full stock"
        },
        isActive: true,
        isFeatured: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    console.log('🎯 Creating sample products with inventory...');
    const insertResult = await productsCollection.insertMany(sampleProducts);
    console.log(`✅ Successfully created ${insertResult.insertedCount} products`);
    
    // Verify the products
    console.log('\n📋 Created products:');
    for (const product of sampleProducts) {
      const availableStock = product.inventory.availableForSale;
      const stockStatus = availableStock === 0 ? '❌ OUT OF STOCK' : availableStock < 10 ? '⚠️ LOW STOCK' : '✅ IN STOCK';
      console.log(`  ${stockStatus} ${product.name} - ${availableStock} available`);
    }
    
    console.log('\n🎉 Sample products created successfully!');
    console.log('💡 Now you can test the add to cart functionality:');
    console.log('   ✅ Products with stock should add to cart successfully');
    console.log('   ⚠️ Low stock products should show warnings');  
    console.log('   ❌ Out of stock products should show "Out of Stock" button');
    
  } catch (error) {
    console.error('❌ Error creating sample products:', error);
  } finally {
    await client.close();
    console.log('📡 Database connection closed');
  }
}

addSampleProducts().catch(console.error);