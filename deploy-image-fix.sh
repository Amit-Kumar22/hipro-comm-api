#!/bin/bash

# Image Upload and Display Fix - Deployment Script
# Run this script to deploy and test all image-related fixes

echo "🚀 Deploying Image Upload and Display Fixes..."

# Step 1: Show current directory and verify files
echo "📁 Current directory: $(pwd)"
echo "📄 Checking fix files..."

FILES_TO_CHECK=(
    "src/controllers/imageController.ts"
    "src/routes/upload.ts"
    "src/routes/images.ts"
    "src/models/Image.ts"
    "src/services/uploadService.ts"
    "test-image-serving.js"
    "fix-product-images.js"
    "IMAGE_SERVING_FIX.md"
)

for FILE in "${FILES_TO_CHECK[@]}"; do
    if [ -f "$FILE" ]; then
        echo "✅ $FILE"
    else
        echo "❌ Missing: $FILE"
    fi
done

# Step 2: Install any missing dependencies
echo ""
echo "📦 Checking dependencies..."
npm list multer express mongoose cors || echo "⚠️ Some dependencies may need installation"

# Step 3: Build the project (if TypeScript)
echo ""
echo "🔨 Building project..."
if [ -f "tsconfig.json" ]; then
    npm run build || echo "⚠️ Build failed - check TypeScript errors"
fi

# Step 4: Test database connection
echo ""
echo "🗄️ Testing database connection..."
node -e "
const mongoose = require('mongoose');
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hipro-comm-db';
mongoose.connect(mongoUri)
  .then(() => {
    console.log('✅ Database connection successful');
    mongoose.disconnect();
  })
  .catch((err) => {
    console.log('❌ Database connection failed:', err.message);
  });
"

# Step 5: Run diagnostic tests
echo ""
echo "🔍 Running image serving diagnostics..."
if [ -f "test-image-serving.js" ]; then
    node test-image-serving.js
else
    echo "❌ test-image-serving.js not found"
fi

# Step 6: Fix existing product images (optional)
echo ""
read -p "🔧 Do you want to fix existing product image URLs? (y/N): " fix_images
if [[ $fix_images =~ ^[Yy]$ ]]; then
    if [ -f "fix-product-images.js" ]; then
        node fix-product-images.js
    else
        echo "❌ fix-product-images.js not found"
    fi
fi

# Step 7: Test production endpoints (if in production)
echo ""
if [ "$NODE_ENV" = "production" ]; then
    echo "🌐 Testing production endpoints..."
    if [ -f "test-production-images.sh" ]; then
        bash test-production-images.sh
    else
        echo "❌ test-production-images.sh not found"
    fi
else
    echo "ℹ️ Not in production mode - skipping production tests"
fi

# Step 8: Restart services
echo ""
read -p "🔄 Do you want to restart the API service? (y/N): " restart_service
if [[ $restart_service =~ ^[Yy]$ ]]; then
    echo "🔄 Restarting API service..."
    
    # Try different restart methods
    if command -v pm2 &> /dev/null; then
        pm2 restart hipro-api || pm2 restart all
    elif command -v systemctl &> /dev/null; then
        sudo systemctl restart hipro-api || echo "⚠️ Service restart failed"
    else
        echo "ℹ️ Please manually restart your API service"
    fi
fi

# Step 9: Final verification
echo ""
echo "✅ Deployment completed!"
echo ""
echo "🧪 To verify the fix:"
echo "1. Upload an image through the admin panel"
echo "2. Create or edit a product with the uploaded image"
echo "3. Check if the image displays on the customer website"
echo "4. Check browser developer tools for any errors"
echo ""
echo "📚 For troubleshooting, see: IMAGE_SERVING_FIX.md"
echo ""

# Show environment info
echo "🌍 Environment Information:"
echo "   NODE_ENV: ${NODE_ENV:-'not set'}"
echo "   API_BASE_URL: ${API_BASE_URL:-'not set'}"
echo "   MONGODB_URI: ${MONGODB_URI:-'not set'}"

echo ""
echo "🎉 Image upload and display fix deployment complete!"