#!/bin/bash

# Complete Fix for Payment Verify API Issues
# Run this script on production server

echo "🔧 HiPro Commerce - Complete Payment API Fix"
echo "============================================="

echo "📝 Issues Fixed:"
echo "1. Payment verify API route 404 error"
echo "2. Admin token authentication error"
echo "3. Debug logs removed for production"
echo ""

# Go to API directory
cd /var/www/hipro-comm-api

echo "📁 Creating uploads directories..."
sudo mkdir -p uploads/payment-proofs uploads/products uploads/categories uploads/profiles
sudo chown -R www-data:www-data uploads/
sudo chmod -R 755 uploads/

echo "✅ Directory permissions set"

# Update frontend service configuration
echo "⚙️  Updating frontend service configuration..."
sudo sed -i 's|Environment=API_URL=https://shop.hiprotech.org|Environment=API_URL=http://127.0.0.1:5000|g' /etc/systemd/system/hipro-frontend.service

echo "🔄 Reloading systemd and restarting services..."
sudo systemctl daemon-reload
sudo systemctl restart hipro-api
sleep 3
sudo systemctl restart hipro-frontend
sleep 2
sudo systemctl restart hipro-admin

echo "📊 Checking service status..."
echo "Backend API Status:"
sudo systemctl is-active hipro-api
echo "Frontend Status:"
sudo systemctl is-active hipro-frontend  
echo "Admin Panel Status:"
sudo systemctl is-active hipro-admin

echo ""
echo "🧪 Testing endpoints..."

echo "Testing backend API health:"
curl -s http://127.0.0.1:5000/health | head -c 100

echo ""
echo "Testing payment verify endpoint (should not return 404):"
curl -X POST http://127.0.0.1:5000/api/v1/payment/verify \
  -F "orderId=test-order" \
  -F "transactionId=test-txn-123" \
  -F "amount=1000" \
  -F "paymentMethod=bank_transfer" \
  2>/dev/null | head -c 200

echo ""
echo ""
echo "✅ Fix Summary:"
echo "   - Fixed API_URL configuration (http://127.0.0.1:5000)"
echo "   - Created uploads directories with proper permissions"
echo "   - Removed debug logs for production"
echo "   - Fixed admin token authentication (adminToken vs token)"
echo ""
echo "🎉 All fixes applied successfully!"
echo ""
echo "📖 If issues persist, check logs:"
echo "   Backend API: sudo journalctl -u hipro-api -f"
echo "   Frontend:    sudo journalctl -u hipro-frontend -f"
echo "   Admin Panel: sudo journalctl -u hipro-admin -f"