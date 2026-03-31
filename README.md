# Rioshop - E-Commerce Backend Server

A modern, scalable Node.js backend API for an e-commerce platform with comprehensive features for product management, order processing, payments, and real-time updates.

## 🚀 Features

- **User Management**: User registration, authentication, and profile management
- **Product Management**: Product catalog, categories, brands, and inventory tracking
- **Shopping Cart**: Add/remove products, manage cart items
- **Orders & Payments**: Order creation, payment processing via integrated payment gateway
- **Wishlist**: Save favorite products for later
- **Reviews & Ratings**: Customer product reviews and ratings
- **Flash Sales**: Time-limited promotional sales
- **Analytics**: Track user behavior and sales analytics
- **Coupons & Discounts**: Promotional code management
- **Shipping**: Shipment tracking and management
- **Notifications**: Real-time notifications for users
- **Real-time Updates**: WebSocket support for live updates
- **Rate Limiting**: API rate limiting for security
- **Admin Panel**: Admin controls and management

## 🛠️ Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB
- **Cache**: Redis
- **File Storage**: Cloudinary
- **Real-time**: Socket.io
- **Authentication**: JWT (JSON Web Tokens)
- **Payment Integration**: Payment gateway (configurable)

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB instance
- Redis instance
- Cloudinary account (for image storage)
- Payment gateway API keys

## 🔧 Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd Rioshop/server
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the `server` directory with the following variables:

   ```
   PORT=5000
   NODE_ENV=development

   # Database (required)
   MONGO_URI=mongodb://localhost:27017/rioshop
   # Legacy alias still supported:
   # MONGODB_URI=mongodb://localhost:27017/rioshop

   # Redis
   REDIS_URL=redis://localhost:6379

   # Cloudinary
   CLOUDINARY_CLOUD_NAME=your_cloudinary_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret

   # JWT
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRE=7d

   # Email Service
   SMTP_HOST=your_smtp_host
   SMTP_PORT=587
   SMTP_USER=your_email
   SMTP_PASS=your_password

   # Payment (MoMo)
   MOMO_PARTNER_CODE=your_partner_code
   MOMO_ACCESS_KEY=your_access_key
   MOMO_SECRET_KEY=your_secret_key
   ```

## 🚀 Running the Server

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on the port specified in your `.env` file (default: 5000).

## 📁 Project Structure

```
server/
├── src/
│   ├── config/           # Configuration files (database, Redis, Cloudinary)
│   ├── constants/        # Application constants
│   ├── controllers/      # Request handlers
│   ├── middlewares/      # Express middlewares (auth, validation, error handling)
│   ├── models/           # Database schemas
│   ├── routes/           # API routes
│   ├── services/         # Business logic services
│   ├── sockets/          # WebSocket handlers
│   ├── utils/            # Utility functions
│   └── validations/      # Request validation schemas
├── server.js             # Application entry point
└── package.json          # Project dependencies
```

## 🔌 API Endpoints (Overview)

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Products

- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product details
- `POST /api/products` - Create product (Admin)
- `PUT /api/products/:id` - Update product (Admin)
- `DELETE /api/products/:id` - Delete product (Admin)

### Orders

- `GET /api/orders` - Get user orders
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id` - Update order status (Admin)

### Cart

- `GET /api/carts` - Get user cart
- `POST /api/carts` - Add to cart
- `PUT /api/carts/:id` - Update cart item
- `DELETE /api/carts/:id` - Remove from cart

### Payments

- `POST /api/payments` - Process payment
- `GET /api/payments/:id` - Get payment details

### Users

- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/:id` - Get user details (Admin)

### Additional Endpoints

- Categories, Coupons, Flash Sales, Reviews, Wishlists, Notifications, Analytics, Shipments

_For detailed API documentation, refer to the route files in `src/routes/`_

## 🔐 Security Features

- JWT-based authentication
- Rate limiting on API endpoints
- Request validation and sanitization
- Error handling middleware
- CORS configuration
- Password hashing

## 🔄 Real-time Features

WebSocket events for:

- Order status updates
- Notifications
- Inventory changes
- Real-time chat (if applicable)

## 📊 Database Models

The application includes the following MongoDB models:

- User
- Product
- Order
- Cart
- Category
- Payment
- Coupon
- Review
- Wishlist
- Admin
- AnalyticsEvent
- BrandConfig
- FlashSale
- Inventory
- Notification
- Shipment

## 🧪 Testing

_(Add testing information if applicable)_

```bash
npm test
```

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit your changes: `git commit -am 'Add new feature'`
3. Push to the branch: `git push origin feature/your-feature`
4. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📧 Support

For support and questions, please contact: [your-email@example.com]

## 🔗 Related Repositories

- Frontend Client: [Frontend Repository URL]
- Mobile App: [Mobile Repository URL]

---

**Last Updated**: March 2026
