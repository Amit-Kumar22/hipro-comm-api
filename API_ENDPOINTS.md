# HiPro Commerce API Documentation

**Base URL:** `http://localhost:5000/api/v1`
**Production URL:** `https://your-domain.com/api/v1`

---

## 🔍 Health Check

### GET `/health`
Server health check endpoint

**Parameters:** None
**Authentication:** Not required

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-12-29T10:30:00.000Z",
  "uptime": 1234.567,
  "environment": "development"
}
```

---

## 🔐 Authentication Endpoints

### POST `/auth/register`
Register a new user

**Authentication:** Not required

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "confirmPassword": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "64f123456789abcdef123456",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "createdAt": "2025-12-29T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "User registered successfully"
}
```

### POST `/auth/login`
Login user

**Authentication:** Not required

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "64f123456789abcdef123456",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Login successful"
}
```

### POST `/auth/logout`
Logout user

**Authentication:** Not required

**Request Body:** None

**Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

### GET `/auth/me`
Get current user profile

**Authentication:** Required (Bearer Token)

**Parameters:** None

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "64f123456789abcdef123456",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "createdAt": "2025-12-29T10:30:00.000Z",
      "updatedAt": "2025-12-29T10:30:00.000Z"
    }
  }
}
```

### PUT `/auth/profile`
Update user profile

**Authentication:** Required (Bearer Token)

**Request Body:**
```json
{
  "name": "John Smith",
  "email": "johnsmith@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "64f123456789abcdef123456",
      "name": "John Smith",
      "email": "johnsmith@example.com",
      "role": "user",
      "updatedAt": "2025-12-29T10:35:00.000Z"
    }
  },
  "message": "Profile updated successfully"
}
```

### PUT `/auth/change-password`
Change user password

**Authentication:** Required (Bearer Token)

**Request Body:**
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123",
  "confirmPassword": "newpassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

## 📂 Categories Endpoints

### GET `/categories`
Get all categories with optional pagination

**Authentication:** Not required

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10)
- `parent` (string, optional): Parent category ID
- `sort` (string, optional): Sort field (name, createdAt)
- `order` (string, optional): Sort order (asc, desc)

**Example:** `GET /categories?page=1&limit=5&sort=name&order=asc`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64f123456789abcdef123456",
      "name": "Electronics",
      "slug": "electronics",
      "description": "Electronic devices and accessories",
      "parentId": null,
      "children": [],
      "createdAt": "2025-12-29T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 12,
    "pages": 3
  }
}
```

### GET `/categories/tree`
Get category tree structure

**Authentication:** Not required

**Parameters:** None

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64f123456789abcdef123456",
      "name": "Electronics",
      "slug": "electronics",
      "children": [
        {
          "_id": "64f123456789abcdef123457",
          "name": "Smartphones",
          "slug": "smartphones",
          "parentId": "64f123456789abcdef123456",
          "children": []
        }
      ]
    }
  ]
}
```

### GET `/categories/by-slug/:slug`
Get category by slug

**Authentication:** Not required

**Path Parameters:**
- `slug` (string, required): Category slug

**Example:** `GET /categories/by-slug/electronics`

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "64f123456789abcdef123456",
    "name": "Electronics",
    "slug": "electronics",
    "description": "Electronic devices and accessories",
    "parentId": null,
    "children": ["64f123456789abcdef123457"],
    "createdAt": "2025-12-29T10:30:00.000Z"
  }
}
```

### GET `/categories/:id`
Get category by ID

**Authentication:** Not required

**Path Parameters:**
- `id` (string, required): Category ID

**Example:** `GET /categories/64f123456789abcdef123456`

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "64f123456789abcdef123456",
    "name": "Electronics",
    "slug": "electronics",
    "description": "Electronic devices and accessories",
    "parentId": null,
    "children": ["64f123456789abcdef123457"],
    "createdAt": "2025-12-29T10:30:00.000Z"
  }
}
```

### POST `/categories`
Create new category (Admin only)

**Authentication:** Required (Bearer Token + Admin role)

**Request Body:**
```json
{
  "name": "Electronics",
  "slug": "electronics",
  "description": "Electronic devices and accessories",
  "parentId": null,
  "image": "category-image.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "64f123456789abcdef123456",
    "name": "Electronics",
    "slug": "electronics",
    "description": "Electronic devices and accessories",
    "parentId": null,
    "image": "category-image.jpg",
    "createdAt": "2025-12-29T10:30:00.000Z",
    "updatedAt": "2025-12-29T10:30:00.000Z"
  },
  "message": "Category created successfully"
}
```

### PUT `/categories/:id`
Update category (Admin only)

**Authentication:** Required (Bearer Token + Admin role)

**Path Parameters:**
- `id` (string, required): Category ID

**Request Body:**
```json
{
  "name": "Updated Electronics",
  "description": "Updated description for electronic devices",
  "image": "new-category-image.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "64f123456789abcdef123456",
    "name": "Updated Electronics",
    "slug": "electronics",
    "description": "Updated description for electronic devices",
    "parentId": null,
    "image": "new-category-image.jpg",
    "updatedAt": "2025-12-29T10:35:00.000Z"
  },
  "message": "Category updated successfully"
}
```

### DELETE `/categories/:id`
Delete category (Admin only)

**Authentication:** Required (Bearer Token + Admin role)

**Path Parameters:**
- `id` (string, required): Category ID

**Request Body:** None

**Response:**
```json
{
  "success": true,
  "message": "Category deleted successfully"
}
```

---

## 🛍️ Products Endpoints

### GET `/products`
Get all products with filtering and pagination

**Authentication:** Not required

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10)
- `category` (string, optional): Category ID or slug
- `minPrice` (number, optional): Minimum price filter
- `maxPrice` (number, optional): Maximum price filter
- `search` (string, optional): Search in name and description
- `featured` (boolean, optional): Filter featured products
- `inStock` (boolean, optional): Filter in-stock products
- `sort` (string, optional): Sort field (name, price, createdAt)
- `order` (string, optional): Sort order (asc, desc)

**Example:** `GET /products?page=1&limit=10&category=electronics&minPrice=100&maxPrice=1000&featured=true&sort=price&order=asc`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64f123456789abcdef123456",
      "name": "iPhone 15 Pro",
      "slug": "iphone-15-pro",
      "description": "Latest iPhone with advanced features",
      "price": 999.99,
      "originalPrice": 1099.99,
      "category": {
        "_id": "64f123456789abcdef123457",
        "name": "Smartphones",
        "slug": "smartphones"
      },
      "images": ["image1.jpg", "image2.jpg"],
      "inStock": true,
      "stockQuantity": 50,
      "featured": true,
      "tags": ["apple", "smartphone", "premium"],
      "createdAt": "2025-12-29T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

### GET `/products/featured`
Get featured products

**Authentication:** Not required

**Query Parameters:**
- `limit` (number, optional): Number of featured products (default: 10)

**Example:** `GET /products/featured?limit=5`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64f123456789abcdef123456",
      "name": "iPhone 15 Pro",
      "slug": "iphone-15-pro",
      "price": 999.99,
      "images": ["image1.jpg"],
      "category": {
        "name": "Smartphones",
        "slug": "smartphones"
      },
      "featured": true
    }
  ]
}
```

### GET `/products/by-slug/:slug`
Get product by slug

**Authentication:** Not required

**Path Parameters:**
- `slug` (string, required): Product slug

**Example:** `GET /products/by-slug/iphone-15-pro`

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "64f123456789abcdef123456",
    "name": "iPhone 15 Pro",
    "slug": "iphone-15-pro",
    "description": "Latest iPhone with advanced features and specifications",
    "price": 999.99,
    "originalPrice": 1099.99,
    "category": {
      "_id": "64f123456789abcdef123457",
      "name": "Smartphones",
      "slug": "smartphones"
    },
    "images": ["image1.jpg", "image2.jpg", "image3.jpg"],
    "inStock": true,
    "stockQuantity": 50,
    "featured": true,
    "specifications": {
      "brand": "Apple",
      "model": "iPhone 15 Pro",
      "storage": "256GB"
    },
    "tags": ["apple", "smartphone", "premium"],
    "createdAt": "2025-12-29T10:30:00.000Z"
  }
}
```

### GET `/products/category/:categoryId`
Get products by category

**Authentication:** Not required

**Path Parameters:**
- `categoryId` (string, required): Category ID

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10)
- `sort` (string, optional): Sort field
- `order` (string, optional): Sort order

**Example:** `GET /products/category/64f123456789abcdef123457?page=1&limit=5`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64f123456789abcdef123456",
      "name": "iPhone 15 Pro",
      "slug": "iphone-15-pro",
      "price": 999.99,
      "images": ["image1.jpg"],
      "inStock": true,
      "category": {
        "_id": "64f123456789abcdef123457",
        "name": "Smartphones"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 15,
    "pages": 3
  }
}
```

### GET `/products/:id`
Get product by ID

**Authentication:** Not required

**Path Parameters:**
- `id` (string, required): Product ID

**Example:** `GET /products/64f123456789abcdef123456`

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "64f123456789abcdef123456",
    "name": "iPhone 15 Pro",
    "slug": "iphone-15-pro",
    "description": "Latest iPhone with advanced features",
    "price": 999.99,
    "category": {
      "_id": "64f123456789abcdef123457",
      "name": "Smartphones",
      "slug": "smartphones"
    },
    "images": ["image1.jpg", "image2.jpg"],
    "inStock": true,
    "stockQuantity": 50,
    "createdAt": "2025-12-29T10:30:00.000Z"
  }
}
```

### POST `/products`
Create new product (Admin only)

**Authentication:** Required (Bearer Token + Admin role)

**Request Body:**
```json
{
  "name": "iPhone 15 Pro",
  "slug": "iphone-15-pro",
  "description": "Latest iPhone with advanced features and A17 Pro chip",
  "price": 999.99,
  "originalPrice": 1099.99,
  "category": "64f123456789abcdef123457",
  "images": ["image1.jpg", "image2.jpg", "image3.jpg"],
  "inStock": true,
  "stockQuantity": 100,
  "featured": true,
  "specifications": {
    "brand": "Apple",
    "model": "iPhone 15 Pro",
    "storage": "256GB",
    "color": "Natural Titanium"
  },
  "tags": ["apple", "smartphone", "premium", "pro"],
  "weight": 187,
  "dimensions": "146.6 x 70.6 x 8.25 mm"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "64f123456789abcdef123456",
    "name": "iPhone 15 Pro",
    "slug": "iphone-15-pro",
    "description": "Latest iPhone with advanced features and A17 Pro chip",
    "price": 999.99,
    "originalPrice": 1099.99,
    "category": "64f123456789abcdef123457",
    "images": ["image1.jpg", "image2.jpg", "image3.jpg"],
    "inStock": true,
    "stockQuantity": 100,
    "featured": true,
    "specifications": {
      "brand": "Apple",
      "model": "iPhone 15 Pro",
      "storage": "256GB",
      "color": "Natural Titanium"
    },
    "tags": ["apple", "smartphone", "premium", "pro"],
    "weight": 187,
    "dimensions": "146.6 x 70.6 x 8.25 mm",
    "createdAt": "2025-12-29T10:30:00.000Z",
    "updatedAt": "2025-12-29T10:30:00.000Z"
  },
  "message": "Product created successfully"
}
```

### PUT `/products/:id`
Update product (Admin only)

**Authentication:** Required (Bearer Token + Admin role)

**Path Parameters:**
- `id` (string, required): Product ID

**Request Body:**
```json
{
  "name": "iPhone 15 Pro Max",
  "description": "Updated description with new features",
  "price": 1199.99,
  "stockQuantity": 75,
  "featured": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "64f123456789abcdef123456",
    "name": "iPhone 15 Pro Max",
    "slug": "iphone-15-pro",
    "description": "Updated description with new features",
    "price": 1199.99,
    "stockQuantity": 75,
    "featured": false,
    "updatedAt": "2025-12-29T10:35:00.000Z"
  },
  "message": "Product updated successfully"
}
```

### DELETE `/products/:id`
Delete product (Admin only)

**Authentication:** Required (Bearer Token + Admin role)

**Path Parameters:**
- `id` (string, required): Product ID

**Request Body:** None

**Response:**
```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

---

## � Cart Endpoints

### GET `/cart`
Get user's shopping cart

**Authentication:** Required (Bearer Token)

**Parameters:** None

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "64f123456789abcdef123456_default_default",
        "product": {
          "_id": "64f123456789abcdef123456",
          "name": "iPhone 15 Pro",
          "slug": "iphone-15-pro",
          "price": {
            "original": 1099.99,
            "selling": 999.99,
            "discount": 100.00
          },
          "images": [
            {
              "url": "iphone15pro-1.jpg",
              "alt": "iPhone 15 Pro Front View",
              "isPrimary": true
            }
          ],
          "category": {
            "_id": "64f123456789abcdef123457",
            "name": "Smartphones",
            "slug": "smartphones"
          },
          "sku": "APPLE-IP15P-256GB",
          "inStock": true
        },
        "quantity": 2,
        "selectedSize": null,
        "selectedColor": null,
        "itemTotal": 1999.98
      }
    ],
    "totals": {
      "totalItems": 2,
      "totalPrice": 1999.98,
      "subtotal": 1999.98,
      "tax": 359.996,
      "shipping": 0,
      "total": 2359.976
    }
  }
}
```

### POST `/cart/add`
Add item to shopping cart

**Authentication:** Required (Bearer Token)

**Request Body:**
```json
{
  "productId": "64f123456789abcdef123456",
  "quantity": 2,
  "selectedSize": "256GB",
  "selectedColor": "Natural Titanium"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Item added to cart successfully",
  "data": {
    "cartItemsCount": 3
  }
}
```

### PUT `/cart/item/:itemId`
Update cart item quantity

**Authentication:** Required (Bearer Token)

**Path Parameters:**
- `itemId` (string, required): Cart item ID

**Request Body:**
```json
{
  "quantity": 3
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cart item updated successfully",
  "data": {
    "cartItemsCount": 3
  }
}
```

### DELETE `/cart/item/:itemId`
Remove item from shopping cart

**Authentication:** Required (Bearer Token)

**Path Parameters:**
- `itemId` (string, required): Cart item ID

**Request Body:** None

**Response:**
```json
{
  "success": true,
  "message": "Item removed from cart successfully",
  "data": {
    "cartItemsCount": 2
  }
}
```

### DELETE `/cart/clear`
Clear entire shopping cart

**Authentication:** Required (Bearer Token)

**Request Body:** None

**Response:**
```json
{
  "success": true,
  "message": "Cart cleared successfully",
  "data": {
    "cartItemsCount": 0
  }
}
```

### GET `/cart/count`
Get cart items count

**Authentication:** Required (Bearer Token)

**Parameters:** None

**Response:**
```json
{
  "success": true,
  "data": {
    "cartItemsCount": 3,
    "totalItems": 5
  }
}
```

---

## �📦 Orders Endpoints

### GET `/orders`
Get orders (Placeholder - To be implemented)

**Authentication:** To be determined

**Response:**
```json
{
  "success": true,
  "data": [],
  "message": "Orders endpoint - Implementation pending"
}
```

---

## 👥 Users Endpoints

### GET `/users`
Get users (Placeholder - To be implemented)

**Authentication:** To be determined

**Response:**
```json
{
  "success": true,
  "data": [],
  "message": "Users endpoint - Implementation pending"
}
```

---

## ⚠️ Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": "Additional error details (optional)"
  }
}
```

### Common Error Codes:
- `VALIDATION_ERROR` - Invalid request data
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `DUPLICATE_ENTRY` - Resource already exists
- `SERVER_ERROR` - Internal server error

---

## 🔑 Authentication

**Token Type:** JWT Bearer Token
**Header Format:** `Authorization: Bearer YOUR_JWT_TOKEN`
**Token Expiry:** 7 days (configurable)
**Admin Privileges:** Required for POST, PUT, DELETE operations

### How to include authentication:
```javascript
// In headers
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 🚦 Rate Limiting

- **Window:** 15 minutes (900,000 ms)
- **Max Requests:** 100 per window per IP
- **Headers Returned:**
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset time

---

## 🔑 Admin Endpoints

All admin endpoints require authentication with Bearer token and admin role.

### GET `/admin/dashboard/stats`
Get dashboard statistics for admin panel

**Authentication:** Required (Bearer Token + Admin role)

**Parameters:** None

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 150,
      "totalProducts": 45,
      "totalCategories": 8,
      "totalOrders": 0,
      "recentProducts": 5,
      "recentUsers": 12
    },
    "topCategories": [
      {
        "name": "Electronics",
        "slug": "electronics",
        "productCount": 15
      }
    ]
  }
}
```

### GET `/admin/dashboard/activity`
Get recent activity for admin dashboard

**Authentication:** Required (Bearer Token + Admin role)

**Query Parameters:**
- `limit` (optional): Number of activities to return (default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "type": "user_registered",
        "title": "New user registered: John Doe",
        "subtitle": "john@example.com",
        "timestamp": "2025-12-29T10:30:00.000Z",
        "id": "64f123456789abcdef123456"
      },
      {
        "type": "product_created",
        "title": "New product added: Smartphone XYZ",
        "subtitle": "₹25000 • Electronics",
        "timestamp": "2025-12-29T09:15:00.000Z",
        "id": "64f123456789abcdef123457"
      }
    ]
  }
}
```

### GET `/admin/users`
Get all users with filtering and pagination

**Authentication:** Required (Bearer Token + Admin role)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `search` (optional): Search by name or email
- `role` (optional): Filter by role (customer/admin)
- `sortBy` (optional): Sort field (default: createdAt)
- `sortOrder` (optional): Sort direction (asc/desc, default: desc)

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "64f123456789abcdef123456",
        "name": "John Doe",
        "email": "john@example.com",
        "role": "customer",
        "phone": "9876543210",
        "createdAt": "2025-12-29T10:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCount": 100,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### GET `/admin/users/:id`
Get single user details

**Authentication:** Required (Bearer Token + Admin role)

**Parameters:**
- `id`: User ID (MongoDB ObjectId)

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "64f123456789abcdef123456",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "customer",
      "phone": "9876543210",
      "createdAt": "2025-12-29T10:30:00.000Z"
    }
  }
}
```

### PUT `/admin/users/:id/role`
Update user role

**Authentication:** Required (Bearer Token + Admin role)

**Parameters:**
- `id`: User ID (MongoDB ObjectId)

**Request Body:**
```json
{
  "role": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "64f123456789abcdef123456",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "admin",
      "phone": "9876543210",
      "createdAt": "2025-12-29T10:30:00.000Z"
    }
  },
  "message": "User role updated to admin"
}
```

### DELETE `/admin/users/:id`
Delete user account (non-admin users only)

**Authentication:** Required (Bearer Token + Admin role)

**Parameters:**
- `id`: User ID (MongoDB ObjectId)

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

### GET `/admin/system`
Get system information and server stats

**Authentication:** Required (Bearer Token + Admin role)

**Parameters:** None

**Response:**
```json
{
  "success": true,
  "data": {
    "systemInfo": {
      "version": "1.0.0",
      "nodeVersion": "v18.17.0",
      "environment": "development",
      "uptime": 3600,
      "memoryUsage": {
        "rss": 45678912,
        "heapTotal": 32456789,
        "heapUsed": 21234567,
        "external": 1234567,
        "arrayBuffers": 123456
      },
      "platform": "darwin"
    }
  }
}
```

---

## 🌐 CORS Configuration

- **Allowed Origin:** `http://localhost:3000` (development)
- **Credentials:** Supported
- **Methods:** GET, POST, PUT, DELETE, PATCH
- **Headers:** Content-Type, Authorization, X-Requested-With

---

## 📋 Usage Notes

1. **All dates** are in ISO 8601 format (UTC)
2. **Pagination** starts from page 1
3. **File uploads** are limited to 10MB
4. **Query parameters** are case-sensitive
5. **MongoDB ObjectId** format for all IDs
6. **Slug fields** are URL-friendly lowercase strings

---

**Last Updated:** December 29, 2025  
**API Version:** v1  
**Server Port:** 5000  
**Database:** hipro-comm-db