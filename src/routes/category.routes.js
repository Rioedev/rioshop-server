import express from "express";
import {
  createCategory,
  getCategories,
  getCategoryTree,
  getCategoryById,
  updateCategory,
  softDeleteCategory,
  hardDeleteCategory,
} from "../controllers/category.controller.js";
import { createValidationMiddleware } from "../middlewares/validation.middleware.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { categorySchema } from "../validations/category.validation.js";

const router = express.Router();

/**
 * ===============================
 * PUBLIC ROUTES
 * ===============================
 */

// Get all categories with pagination (MUST BE FIRST)
router.get("/", getCategories);

// Get category tree (hierarchical structure) - MUST BE BEFORE /:id
router.get("/tree", getCategoryTree);

/**
 * ===============================
 * AUTH REQUIRED ROUTES
 * ===============================
 */

// Create category
router.post(
  "/add",
  // authMiddleware,
  upload.single("image"),
  createValidationMiddleware(categorySchema),
  createCategory,
);

// Update category
router.put(
  "/:id",
  // authMiddleware,
  upload.single("image"),
  updateCategory,
);

// Soft delete category (mark as deleted)
router.patch(
  "/:id/soft-delete",
  // authMiddleware,
  softDeleteCategory,
);

// Hard delete category (permanently remove)
router.delete(
  "/:id",
  // authMiddleware,
  hardDeleteCategory,
);

// Get category by ID (MUST BE LAST to avoid conflicts with /:id routes)
router.get("/:id", getCategoryById);

export default router;
