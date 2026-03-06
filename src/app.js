import express from "express";
import cors from "cors";
import morgan from "morgan";
import ApiResponse from "./utils/ApiResponse.js";
import { ApiError } from "./utils/asyncHandler.js";
import { HTTP_STATUS } from "./config/constants.js";

import authRoute from "./routes/auth.routes.js";
import productRoute from "./routes/product.routes.js";
import categoryRoute from "./routes/category.routes.js";

const app = express();

/**
 * ===============================
 * MIDDLEWARE
 * ===============================
 */

// Parse application/json
app.use(express.json());

// Parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(cors());

// Logging
app.use(morgan("dev"));

/**
 * ===============================
 * ROUTES
 * ===============================
 */

app.use("/api/auth", authRoute);
app.use("/api/products", productRoute);
app.use("/api/categories", categoryRoute);

/**
 * ===============================
 * 404 - NOT FOUND HANDLER
 * ===============================
 */

app.use((req, res) => {
  return ApiResponse.notFound(res, "API endpoint not found");
});

/**
 * ===============================
 * GLOBAL ERROR HANDLER
 * ===============================
 */

app.use((err, req, res, next) => {
  console.error("🔥 ERROR:", err);

  // Handle custom API errors
  if (err instanceof ApiError) {
    return ApiResponse.error(res, err.message, err.statusCode, err.errors);
  }

  // Handle Joi validation errors
  if (err.isJoi) {
    const errors = err.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
    }));
    return ApiResponse.error(
      res,
      err.message,
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      errors,
    );
  }

  // Handle MongoDB errors
  if (err.name === "MongoError" || err.name === "MongoServerError") {
    return ApiResponse.error(
      res,
      "Database error",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    return ApiResponse.unauthorized(res, "Invalid token");
  }

  if (err.name === "TokenExpiredError") {
    return ApiResponse.unauthorized(res, "Token expired");
  }

  // Default error
  const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = err.message || "Internal server error";

  return ApiResponse.error(res, message, statusCode);
});

export default app;
