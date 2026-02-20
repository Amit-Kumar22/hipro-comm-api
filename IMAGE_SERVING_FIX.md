# Image Upload and Serving Fix Documentation

## Problem Description
In production, images uploaded through the admin panel were not displaying on the customer website, while they worked correctly in the local development environment.

## Root Cause Analysis
The issue was caused by several factors:

1. **CORS Headers**: Cross-origin requests for images were being blocked due to missing CORS headers
2. **URL Generation**: Inconsistent base URL generation across different parts of the application
3. **Environment Configuration**: Production environment variables not being used consistently
4. **Error Handling**: Frontend components lacking proper fallbacks for failed image loads

## Solution Implemented

### 1. Backend API Fixes

#### Enhanced CORS Headers for Images
**File**: `src/controllers/imageController.ts`
- Added explicit CORS headers to image serving endpoint:
  - `Access-Control-Allow-Origin: *`
  - `Cross-Origin-Resource-Policy: cross-origin`
  - `Access-Control-Allow-Methods: GET, OPTIONS`

#### Improved URL Generation
**Files**: 
- `src/controllers/imageController.ts`
- `src/routes/upload.ts`
- `src/models/Image.ts`
- `src/services/uploadService.ts`

Enhanced image URL generation logic:
```javascript
// Priority: Custom API URL > Environment-specific URL > Default fallback
let baseUrl;
if (process.env.API_BASE_URL) {
  baseUrl = process.env.API_BASE_URL;
} else if (process.env.NODE_ENV === 'production') {
  baseUrl = 'https://shop.hiprotech.org';
} else {
  baseUrl = 'http://localhost:5001';
}
baseUrl = baseUrl.replace(/\/$/, '');
return `${baseUrl}/api/v1/images/${imageId}`;
```

#### Added OPTIONS Handler
**File**: `src/routes/images.ts`
- Added explicit OPTIONS handler for CORS preflight requests

### 2. Frontend Fixes

#### Enhanced Image URL Handling
**File**: `components/ui/ProductCard.tsx`
- Added detection for image IDs vs full URLs
- Improved error handling with fallback images
- Enhanced image URL construction for production

```typescript
const getImageUrl = (imageData?: { url?: string; alt: string; isPrimary: boolean }) => {
  if (!imageData?.url) {
    return '/placeholder.png';
  }

  // If it's just an image ID (24 character hex), construct full URL
  const imageIdRegex = /^[0-9a-fA-F]{24}$/;
  if (imageIdRegex.test(imageData.url)) {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 
      (typeof window !== 'undefined' ? window.location.origin : 'https://shop.hiprotech.org');
    return `${apiBaseUrl}/api/v1/images/${imageData.url}`;
  }

  return getOptimizedImageUrl(imageData.url, 600);
};
```

#### Enhanced Image Helper Library
**File**: `lib/image-enhanced.ts`
- Added better error handling
- Improved production URL detection
- Added image validation functions
- Enhanced fallback mechanisms

### 3. Diagnostic Tools

#### Image Serving Test Script
**File**: `test-image-serving.js`
- Tests database connectivity
- Validates existing images
- Checks URL accessibility
- Verifies environment configuration

#### Product Image Fix Script
**File**: `fix-product-images.js`
- Fixes broken image URLs in existing products
- Converts image IDs to full URLs
- Validates image existence in database
- Reports fix statistics

#### Production Testing Script
**File**: `test-production-images.sh`
- Tests complete production environment
- Checks API accessibility
- Validates CORS configuration
- Tests customer and admin websites

## How the Image System Works

### Image Upload Flow
1. **Admin uploads image** → `POST /api/v1/upload/image`
2. **Image stored in database** → MongoDB `images` collection as binary data
3. **API returns image URL** → `https://shop.hiprotech.org/api/v1/images/{imageId}`
4. **Product references URL** → Stored in product's `images` array
5. **Customer views product** → Frontend requests image from API URL

### Image Serving Flow
1. **Frontend requests image** → `GET /api/v1/images/{imageId}`
2. **API retrieves from database** → `Image.findById(imageId)`
3. **Headers set** → Content-Type, CORS, Cache headers
4. **Binary data sent** → `res.send(image.data)`

### URL Generation Priority
1. `process.env.API_BASE_URL` (if set)
2. Production default: `https://shop.hiprotech.org`
3. Development default: `http://localhost:5001`

## Environment Variables

### Required Variables
```bash
# Production
NODE_ENV=production
API_BASE_URL=https://shop.hiprotech.org  # Optional, uses default if not set
MONGODB_URI=mongodb://...

# Frontend
NEXT_PUBLIC_API_URL=https://shop.hiprotech.org/api/v1
```

## Troubleshooting Steps

### 1. Check Image Accessibility
```bash
# Test if a specific image is accessible
curl -I "https://shop.hiprotech.org/api/v1/images/{imageId}"
```

### 2. Verify Database Connection
```bash
# Run the diagnostic script
node test-image-serving.js
```

### 3. Fix Broken Product Images
```bash
# Run the fix script
node fix-product-images.js
```

### 4. Check CORS Headers
```bash
# Test CORS with browser developer tools or:
curl -H "Origin: https://shop.hiprotech.org" -I "https://shop.hiprotech.org/api/v1/images/{imageId}"
```

### 5. Verify Environment Configuration
- Check that `NODE_ENV=production` in production
- Verify `NEXT_PUBLIC_API_URL` matches your API base URL
- Ensure MongoDB connection is working

## Common Issues and Solutions

### Issue: Images not loading in production
**Solution**: Check CORS headers and URL generation

### Issue: "Invalid image source" errors
**Solution**: Verify image URLs are properly constructed with full domain

### Issue: CORS errors in browser console
**Solution**: Ensure OPTIONS handler is working and CORS headers are set

### Issue: Images work locally but not in production
**Solution**: Verify environment variables and base URL configuration

## Testing Checklist

- [ ] Images upload successfully through admin panel
- [ ] Image URLs are generated with correct domain
- [ ] Images display on customer website
- [ ] CORS headers allow cross-origin access
- [ ] Error handling shows placeholder for failed images
- [ ] Database contains valid image data
- [ ] Environment variables are correctly set

## Monitoring

### Production Health Checks
1. API health endpoint: `https://shop.hiprotech.org/api/v1/health`
2. Sample image load: Test a known image ID
3. CORS validation: Check cross-origin requests
4. Database connectivity: Verify MongoDB connection

### Log Monitoring
Monitor server logs for:
- Image serving errors
- CORS-related issues
- Database connection problems
- Invalid image ID requests

## Future Improvements

1. **CDN Integration**: Consider using a CDN for better image delivery
2. **Image Optimization**: Add automatic image resizing and format optimization
3. **Caching Strategy**: Implement better caching for frequently accessed images
4. **Error Tracking**: Add comprehensive error logging and monitoring
5. **Performance Monitoring**: Track image load times and failures