# HiproTech Commerce API

A production-ready Express.js backend API for the HiproTech e-commerce platform, separated from the Next.js frontend for better scalability and maintainability.

## 🚀 Features

- **Express.js** REST API with TypeScript
- **MongoDB** with Mongoose ODM
- **JWT Authentication** with role-based access control
- **Zod Validation** for request/response schemas
- **Rate Limiting** and security middleware
- **CORS** configured for Next.js frontend
- **Error Handling** with custom error classes
- **Health Check** endpoints for monitoring
- **Production-ready** logging and error tracking

## 📁 Project Structure

```
src/
├── config/          # Configuration files
│   ├── database.ts  # MongoDB connection
│   └── env.ts       # Environment variables
├── controllers/     # Route controllers
│   └── authController.ts
├── middleware/      # Custom middleware
│   ├── authMiddleware.ts
│   └── errorMiddleware.ts
├── models/          # Mongoose models
│   └── User.ts
├── routes/          # API routes
│   ├── auth.ts
│   ├── categories.ts
│   ├── products.ts
│   └── orders.ts
└── server.ts        # Application entry point
```

## 🛠️ Setup

### Prerequisites

- Node.js 18+
- MongoDB 5+
- npm or yarn

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment setup:**
   ```bash
   cp .env.example .env
   ```

3. **Configure environment variables:**
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/hiprotech
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRES_IN=7d
   FRONTEND_URL=http://localhost:3000
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Build for production:**
   ```bash
   npm run build
   npm start
   ```

## 🔗 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/logout` - Logout

### Products
- `GET /api/products` - Get products with filters
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product (Admin)
- `PUT /api/products/:id` - Update product (Admin)
- `DELETE /api/products/:id` - Delete product (Admin)

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/:slug` - Get category by slug
- `POST /api/categories` - Create category (Admin)

### Health Check
- `GET /health` - Application health status

## 🔒 Authentication & Authorization

The API uses JWT-based authentication with Bearer tokens:

```typescript
// Protected route example
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

fetch('/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### Roles
- **Customer**: Can view products, manage own profile, place orders
- **Admin**: Full access to all resources and management functions

## 📊 Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "details": [
    // Validation errors if applicable
  ]
}
```

## 🔧 Development

### Scripts
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run lint` - Lint code with ESLint
- `npm run lint:fix` - Fix linting issues
- `npm test` - Run tests

### Database Seeding
```bash
npm run seed
```

## 🚀 Production Deployment

### Docker
```bash
# Build image
docker build -t hipro-api .

# Run container
docker run -p 5000:5000 --env-file .env hipro-api
```

### PM2 (Process Manager)
```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
npm run build
pm2 start ecosystem.config.js --env production
```

## 🛡️ Security Features

- **Helmet.js** for security headers
- **Rate limiting** (100 requests per 15 minutes)
- **CORS** protection with configurable origins
- **MongoDB injection** protection
- **Input validation** with Zod schemas
- **JWT token** expiration and validation
- **Password hashing** with bcrypt (12 salt rounds)

## 📈 Monitoring

### Health Check
```bash
curl http://localhost:5000/health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "environment": "production"
}
```

### Logging
- Development: Console logging with colors
- Production: File-based logging with rotation
- Error tracking with Sentry (optional)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with proper tests
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   ```
   MongooseServerSelectionError: connect ECONNREFUSED
   ```
   - Ensure MongoDB is running
   - Check `MONGODB_URI` in environment variables

2. **JWT Token Error**
   ```
   JsonWebTokenError: invalid signature
   ```
   - Verify `JWT_SECRET` matches between backend and frontend
   - Check token expiration

3. **CORS Error**
   ```
   Access-Control-Allow-Origin header is missing
   ```
   - Verify `FRONTEND_URL` in environment variables
   - Check CORS configuration in `server.ts`

### Debug Mode
```bash
DEBUG=* npm run dev
```

## 📞 Support

For technical support or questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation in `/docs`# hipro-comm-api
