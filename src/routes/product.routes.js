import express from "express";
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  softDeleteProduct,
  restoreProduct,
  hardDeleteProduct,
} from "../controllers/product.controller.js";
import { createValidationMiddleware } from "../middlewares/validation.middleware.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import { upload as uploadMiddleware } from "../middlewares/upload.middleware.js";
import {
  createProductSchema,
  updateProductSchema,
} from "../validations/product.validation.js";

const router = express.Router();

/**
 * ===============================
 * PUBLIC ROUTES
 * ===============================
 */

// Get all products with pagination
router.get("/", getAllProducts);

/**
 * ===============================
 * AUTH REQUIRED ROUTES
 * ===============================
 */

// Create product
router.post(
  "/add",
  // authMiddleware,
  uploadMiddleware.array("image", 20),
  createValidationMiddleware(createProductSchema),
  createProduct,
);

// Update product
router.put(
  "/:id",
  // authMiddleware,
  uploadMiddleware.array("image", 20),
  createValidationMiddleware(updateProductSchema),
  updateProduct,
);

// Soft delete product (mark as archived)
router.patch("/:id/soft-delete", softDeleteProduct);

// Restore product
router.patch("/:id/restore", restoreProduct);

// Hard delete product (permanently remove)
router.delete("/:id", hardDeleteProduct);

// Get product by ID (MUST BE LAST to avoid conflicts with /:id routes)
router.get("/:id", getProductById);

export default router;
