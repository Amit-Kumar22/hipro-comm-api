import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './env.js';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'HiproTech Commerce API',
      version: '1.0.0',
      description: 'A comprehensive e-commerce API built with Node.js, Express, and MongoDB',
      contact: {
        name: 'HiproTech Support',
        url: 'https://hiprotech.com',
        email: 'support@hiprotech.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'Admin user authentication endpoints'
      },
      {
        name: 'Customer Auth', 
        description: 'Customer authentication and registration endpoints'
      },
      {
        name: 'Categories',
        description: 'Product category management'
      },
      {
        name: 'Products',
        description: 'Product catalog and inventory management'
      },
      {
        name: 'Cart',
        description: 'Shopping cart operations'
      },
      {
        name: 'Orders',
        description: 'Order processing and management'
      },
      {
        name: 'Payments',
        description: 'Payment processing and transactions'
      },
      {
        name: 'Users',
        description: 'User management (Admin)'
      },
      {
        name: 'Admin',
        description: 'Administrative operations'
      }
    ],
    servers: [
      {
        url: `http://localhost:${config.PORT || 8080}`,
        description: 'Development server'
      },
      {
        url: 'http://77.37.44.182:8080',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Authorization header using the Bearer scheme'
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token',
          description: 'JWT token stored in cookie'
        }
      },
      schemas: {
        User: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            _id: {
              type: 'string',
              description: 'Unique user identifier'
            },
            name: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
              description: 'User full name'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            password: {
              type: 'string',
              minLength: 6,
              description: 'User password (hashed)'
            },
            phone: {
              type: 'string',
              pattern: '^\\d{10}$',
              description: 'User phone number'
            },
            role: {
              type: 'string',
              enum: ['user', 'admin'],
              default: 'user',
              description: 'User role'
            },
            isActive: {
              type: 'boolean',
              default: true,
              description: 'User active status'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'User creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'User last update timestamp'
            }
          }
        },
        Customer: {
          type: 'object',
          required: ['name', 'email'],
          properties: {
            _id: {
              type: 'string',
              description: 'Unique customer identifier'
            },
            name: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
              description: 'Customer full name'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Customer email address'
            },
            phone: {
              type: 'string',
              pattern: '^\\d{10}$',
              description: 'Customer phone number'
            },
            address: {
              type: 'object',
              properties: {
                street: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                zipCode: { type: 'string' },
                country: { type: 'string', default: 'India' }
              }
            },
            isVerified: {
              type: 'boolean',
              default: false,
              description: 'Customer email verification status'
            }
          }
        },
        Category: {
          type: 'object',
          required: ['name', 'slug'],
          properties: {
            _id: {
              type: 'string',
              description: 'Unique category identifier'
            },
            name: {
              type: 'string',
              description: 'Category name'
            },
            slug: {
              type: 'string',
              description: 'Category URL slug'
            },
            description: {
              type: 'string',
              description: 'Category description'
            },
            image: {
              type: 'string',
              description: 'Category image URL'
            },
            isActive: {
              type: 'boolean',
              default: true,
              description: 'Category active status'
            }
          }
        },
        Product: {
          type: 'object',
          required: ['name', 'price', 'category'],
          properties: {
            _id: {
              type: 'string',
              description: 'Unique product identifier'
            },
            name: {
              type: 'string',
              description: 'Product name'
            },
            slug: {
              type: 'string',
              description: 'Product URL slug'
            },
            description: {
              type: 'string',
              description: 'Product description'
            },
            price: {
              type: 'number',
              minimum: 0,
              description: 'Product price'
            },
            comparePrice: {
              type: 'number',
              minimum: 0,
              description: 'Product compare at price'
            },
            category: {
              type: 'string',
              description: 'Product category ID'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Product tags'
            },
            images: {
              type: 'array',
              items: { type: 'string' },
              description: 'Product image URLs'
            },
            inventory: {
              type: 'object',
              properties: {
                quantity: { type: 'number', minimum: 0 },
                sku: { type: 'string' },
                trackQuantity: { type: 'boolean', default: true },
                allowBackorders: { type: 'boolean', default: false }
              }
            },
            isActive: {
              type: 'boolean',
              default: true,
              description: 'Product active status'
            },
            isFeatured: {
              type: 'boolean',
              default: false,
              description: 'Product featured status'
            }
          }
        },
        Order: {
          type: 'object',
          required: ['customer', 'items', 'totalAmount'],
          properties: {
            _id: {
              type: 'string',
              description: 'Unique order identifier'
            },
            orderNumber: {
              type: 'string',
              description: 'Unique order number'
            },
            customer: {
              type: 'string',
              description: 'Customer ID'
            },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  product: { type: 'string' },
                  quantity: { type: 'number', minimum: 1 },
                  price: { type: 'number', minimum: 0 }
                }
              }
            },
            totalAmount: {
              type: 'number',
              minimum: 0,
              description: 'Order total amount'
            },
            status: {
              type: 'string',
              enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
              default: 'pending'
            },
            shippingAddress: {
              type: 'object',
              properties: {
                street: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                zipCode: { type: 'string' },
                country: { type: 'string' }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              description: 'Error message'
            },
            errors: {
              type: 'array',
              items: { type: 'string' },
              description: 'Detailed error messages'
            }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message'
            },
            data: {
              type: 'object',
              description: 'Response data'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      },
      {
        cookieAuth: []
      }
    ]
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts'
  ]
};

const specs = swaggerJsdoc(options);

export default specs;