# Image Upload and Display Fix - Windows PowerShell Deployment Script
# Run this script to deploy and test all image-related fixes

Write-Host "🚀 Deploying Image Upload and Display Fixes..." -ForegroundColor Green

# Step 1: Show current directory and verify files
Write-Host "📁 Current directory: $(Get-Location)" -ForegroundColor Cyan
Write-Host "📄 Checking fix files..." -ForegroundColor Cyan

$FilesToCheck = @(
    "src/controllers/imageController.ts",
    "src/routes/upload.ts",
    "src/routes/images.ts",
    "src/models/Image.ts",
    "src/services/uploadService.ts",
    "test-image-serving.js",
    "fix-product-images.js",
    "IMAGE_SERVING_FIX.md"
)

foreach ($File in $FilesToCheck) {
    if (Test-Path $File) {
        Write-Host "✅ $File" -ForegroundColor Green
    } else {
        Write-Host "❌ Missing: $File" -ForegroundColor Red
    }
}

# Step 2: Check if Node.js is available
Write-Host ""
Write-Host "📦 Checking Node.js..." -ForegroundColor Cyan
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found" -ForegroundColor Red
    return
}

# Step 3: Test database connection
Write-Host ""
Write-Host "🗄️ Testing database connection..." -ForegroundColor Cyan
$testDbScript = @"
const mongoose = require('mongoose');
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hipro-comm-db';
mongoose.connect(mongoUri)
  .then(() => {
    console.log('✅ Database connection successful');
    process.exit(0);
  })
  .catch((err) => {
    console.log('❌ Database connection failed:', err.message);
    process.exit(1);
  });
"@

$testDbScript | Out-File -FilePath "temp-db-test.js" -Encoding UTF8
try {
    node "temp-db-test.js"
    Remove-Item "temp-db-test.js" -ErrorAction SilentlyContinue
} catch {
    Write-Host "❌ Database test script failed" -ForegroundColor Red
    Remove-Item "temp-db-test.js" -ErrorAction SilentlyContinue
}

# Step 4: Run diagnostic tests
Write-Host ""
Write-Host "🔍 Running image serving diagnostics..." -ForegroundColor Cyan
if (Test-Path "test-image-serving.js") {
    try {
        node "test-image-serving.js"
    } catch {
        Write-Host "❌ Diagnostic test failed" -ForegroundColor Red
    }
} else {
    Write-Host "❌ test-image-serving.js not found" -ForegroundColor Red
}

# Step 5: Ask about fixing existing images
Write-Host ""
$fixImages = Read-Host "🔧 Do you want to fix existing product image URLs? (y/N)"
if ($fixImages -match "^[Yy]$") {
    if (Test-Path "fix-product-images.js") {
        try {
            node "fix-product-images.js"
        } catch {
            Write-Host "❌ Image fix script failed" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ fix-product-images.js not found" -ForegroundColor Red
    }
}

# Step 6: Show environment info
Write-Host ""
Write-Host "🌍 Environment Information:" -ForegroundColor Cyan
Write-Host "   NODE_ENV: $($env:NODE_ENV ?? 'not set')" -ForegroundColor White
Write-Host "   API_BASE_URL: $($env:API_BASE_URL ?? 'not set')" -ForegroundColor White
Write-Host "   MONGODB_URI: $($env:MONGODB_URI ?? 'not set')" -ForegroundColor White

# Step 7: Final instructions
Write-Host ""
Write-Host "✅ Deployment completed!" -ForegroundColor Green
Write-Host ""
Write-Host "🧪 To verify the fix:" -ForegroundColor Yellow
Write-Host "1. Upload an image through the admin panel" -ForegroundColor White
Write-Host "2. Create or edit a product with the uploaded image" -ForegroundColor White
Write-Host "3. Check if the image displays on the customer website" -ForegroundColor White
Write-Host "4. Check browser developer tools for any errors" -ForegroundColor White
Write-Host ""
Write-Host "📚 For troubleshooting, see: IMAGE_SERVING_FIX.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎉 Image upload and display fix deployment complete!" -ForegroundColor Green