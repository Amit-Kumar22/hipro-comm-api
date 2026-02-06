#!/bin/bash

# Production Server Configuration Script for Video Upload Fix
# Run this script on your production server (shop.hiprotech.org)

echo "🔧 Fixing 413 Request Entity Too Large Error for Video Uploads"
echo "================================================="

# Backup current nginx configuration
echo "📁 Backing up current nginx configuration..."
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S)

# Create or update nginx site configuration
echo "📝 Updating nginx configuration..."

# Create the new configuration
sudo tee /etc/nginx/sites-available/shop.hiprotech.org > /dev/null <<EOF
server {
    listen 80;
    server_name shop.hiprotech.org;
    
    # CRITICAL: Increase file upload limits for video uploads
    client_max_body_size 60M;
    client_body_timeout 300s;
    client_header_timeout 300s;
    keepalive_timeout 300s;
    send_timeout 300s;
    
    # Buffer settings for large uploads
    client_body_buffer_size 128k;
    client_header_buffer_size 4k;
    
    # Special handling for upload endpoints
    location /api/v1/upload/ {
        # Even larger limits for upload endpoints specifically
        client_max_body_size 60M;
        client_body_timeout 600s;  # 10 minutes for video uploads
        
        # Disable buffering for large file uploads
        proxy_request_buffering off;
        proxy_buffering off;
        proxy_max_temp_file_size 0;
        
        # Proxy to Node.js application
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Regular proxy settings for other routes
    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}

# HTTPS configuration (if SSL is enabled)
server {
    listen 443 ssl;
    server_name shop.hiprotech.org;
    
    # SSL certificates (update paths as needed)
    # ssl_certificate /path/to/your/certificate.crt;
    # ssl_certificate_key /path/to/your/private.key;
    
    # Same upload settings as HTTP
    client_max_body_size 60M;
    client_body_timeout 300s;
    client_header_timeout 300s;
    keepalive_timeout 300s;
    send_timeout 300s;
    
    location /api/v1/upload/ {
        client_max_body_size 60M;
        client_body_timeout 600s;
        
        proxy_request_buffering off;
        proxy_buffering off;
        proxy_max_temp_file_size 0;
        
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable the site (if not already enabled)
if [ -f /etc/nginx/sites-available/shop.hiprotech.org ]; then
    sudo ln -sf /etc/nginx/sites-available/shop.hiprotech.org /etc/nginx/sites-enabled/
fi

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
    
    # Reload nginx
    echo "🔄 Reloading nginx..."
    sudo systemctl reload nginx
    
    echo "✅ Nginx reloaded successfully"
    echo ""
    echo "🎥 Video upload fix applied! You can now upload videos up to 50MB"
    echo "📝 Configuration details:"
    echo "   - Maximum file size: 60MB"
    echo "   - Upload timeout: 10 minutes"
    echo "   - Buffering: Disabled for large files"
    echo ""
    echo "🔄 Don't forget to also restart your Node.js application:"
    echo "   pm2 restart hipro-api"
    echo "   # or"
    echo "   systemctl restart hipro-api"
    
else
    echo "❌ Nginx configuration test failed!"
    echo "📋 Please check the configuration and try again."
    echo "🔙 Restoring backup..."
    sudo cp /etc/nginx/sites-available/default.backup.$(date +%Y%m%d)* /etc/nginx/sites-available/default
    exit 1
fi
EOF