import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { Server } from "socket.io";
import http from "http";
import dotenv from "dotenv";

import connectDB from "./src/config/database.js";
import { redisClient } from "./src/config/redis.js";
import errorHandler from "./src/middlewares/errorHandler.js";
import rateLimiter from "./src/middlewares/rateLimiter.js";

// Routes
import productRoutes from "./src/routes/products.js";
import categoryRoutes from "./src/routes/categories.js";
import userRoutes from "./src/routes/users.js";
import authRoutes from "./src/routes/auth.js";
import cartRoutes from "./src/routes/carts.js";
import orderRoutes from "./src/routes/orders.js";
import paymentRoutes from "./src/routes/payments.js";
import shipmentRoutes from "./src/routes/shipments.js";
import reviewRoutes from "./src/routes/reviews.js";
import wishlistRoutes from "./src/routes/wishlists.js";
import couponRoutes from "./src/routes/coupons.js";
import notificationRoutes from "./src/routes/notifications.js";
import analyticsRoutes from "./src/routes/analytics.js";
import inventoryRoutes from "./src/routes/inventories.js";
import adminRoutes from "./src/routes/admins.js";
import flashSaleRoutes from "./src/routes/flashSales.js";
import brandConfigRoutes from "./src/routes/brandConfigs.js";

// Socket handlers
import initializeSocketHandlers from "./src/sockets/handlers.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (curl, postman)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.length === 0 || allowedOrigins.includes("*")) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : "*",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(helmet());
app.use(morgan("combined"));
app.use(
  cors(corsOptions),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(rateLimiter);

// Connect to Database and Redis
const initializeApp = async () => {
  try {
    await connectDB();
    console.log("MongoDB connected");
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }

  try {
    await redisClient.connect();
    console.log("Redis connected");
  } catch (error) {
    console.error("Redis connection failed, running without Redis:", error);
  }
};

// Routes
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/carts", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/shipments", shipmentRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/wishlists", wishlistRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/inventories", inventoryRoutes);
app.use("/api/admins", adminRoutes);
app.use("/api/flash-sales", flashSaleRoutes);
app.use("/api/brand-configs", brandConfigRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to Rioshop API",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      products: "/api/products",
      categories: "/api/categories",
      users: "/api/users",
      auth: "/api/auth",
      carts: "/api/carts",
      orders: "/api/orders",
      payments: "/api/payments",
    },
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// Error handling middleware
app.use(errorHandler);

// Socket.IO configuration
initializeSocketHandlers(io);

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await initializeApp();

  server.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

export default app;

