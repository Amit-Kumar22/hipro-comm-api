#!/bin/bash

echo "🔍 Testing CORS Configuration..."
echo ""

# Test preflight request
echo "Testing OPTIONS preflight request:"
curl -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v \
  http://localhost:8080/api/v1/auth/register

echo ""
echo ""

# Test actual request
echo "Testing actual POST request:"
curl -X POST \
  -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"123456"}' \
  -v \
  http://localhost:8080/api/v1/auth/register

echo ""
echo "🏁 CORS test completed!"