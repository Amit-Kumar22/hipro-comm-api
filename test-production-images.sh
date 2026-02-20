#!/bin/bash

# Production Image Testing Script
# Run this script to test the complete image upload and display flow

echo "🧪 Testing Production Image Flow..."

# Test 1: Check if API is accessible
echo "📡 Testing API accessibility..."
API_URL="https://shop.hiprotech.org/api/v1"
curl -I "$API_URL/health" || echo "❌ API health check failed"

# Test 2: Check if existing images are accessible
echo "🖼️ Testing existing image accessibility..."
# You'll need to replace this with actual image IDs from your database
TEST_IMAGE_IDS=(
    # Add some actual image IDs from your database here for testing
    # "64f8a123b456c789d0123456"
    # "64f8a123b456c789d0123457"
)

for IMAGE_ID in "${TEST_IMAGE_IDS[@]}"; do
    if [ -n "$IMAGE_ID" ]; then
        echo "Testing image: $IMAGE_ID"
        IMAGE_URL="$API_URL/images/$IMAGE_ID"
        RESPONSE=$(curl -I "$IMAGE_URL" 2>/dev/null | head -n 1)
        if echo "$RESPONSE" | grep -q "200 OK"; then
            echo "✅ Image accessible: $IMAGE_ID"
        else
            echo "❌ Image not accessible: $IMAGE_ID"
            echo "   Response: $RESPONSE"
        fi
    fi
done

# Test 3: Check CORS headers
echo "🌐 Testing CORS headers..."
curl -I -H "Origin: https://shop.hiprotech.org" "$API_URL/health" | grep -i "access-control" || echo "⚠️ CORS headers may not be set"

# Test 4: Check customer website accessibility
echo "🛒 Testing customer website..."
CUSTOMER_URL="https://shop.hiprotech.org"
curl -I "$CUSTOMER_URL" || echo "❌ Customer website not accessible"

# Test 5: Check admin panel accessibility
echo "👨‍💼 Testing admin panel..."
ADMIN_URL="https://adminshop.hiprotech.org"
curl -I "$ADMIN_URL" || echo "❌ Admin panel not accessible"

echo "✅ Production testing completed"
echo ""
echo "🔧 To fix image issues, run the following scripts on your server:"
echo "   1. node test-image-serving.js"
echo "   2. node fix-product-images.js"
echo ""
echo "📝 If issues persist, check:"
echo "   - Server logs for errors"
echo "   - Database connectivity"
echo "   - NGINX/Apache configuration for image serving"
echo "   - Environment variables (NODE_ENV, API_BASE_URL)"