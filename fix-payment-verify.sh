#!/bin/bash

# Quick fix for payment verify API issue
# Run this script on production server

echo "🔧 HiPro Commerce - Payment Verify API Fix"
echo "============================================"

# Go to API directory
cd /var/www/hipro-comm-api

echo "📁 Creating uploads directories..."
sudo mkdir -p uploads/payment-proofs uploads/products uploads/categories uploads/profiles
sudo chown -R www-data:www-data uploads/
sudo chmod -R 755 uploads/

echo "✅ Directory permissions set"

echo "🔄 Restarting services..."
sudo systemctl restart hipro-api
sleep 2
sudo systemctl restart hipro-frontend

echo "📊 Checking service status..."
sudo systemctl status hipro-api --no-pager -l
echo ""
sudo systemctl status hipro-frontend --no-pager -l

echo ""
echo "🧪 Testing payment verify endpoint..."
curl -X POST http://127.0.0.1:5000/api/v1/payment/verify \
  -F "orderId=test-order" \
  -F "transactionId=test-txn-123" \
  -F "amount=1000" \
  -F "paymentMethod=bank_transfer" \
  2>/dev/null | head -c 200

echo ""
echo ""
echo "🎉 Fix applied! Check the logs if issues persist:"
echo "   Backend logs: sudo journalctl -u hipro-api -f"
echo "   Frontend logs: sudo journalctl -u hipro-frontend -f"