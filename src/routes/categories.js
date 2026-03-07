import express from "express";
import {
  getAllCategories,
  getCategoryTree,
  getCategoryBySlug,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getSubcategories,
  searchCategories,
  getCategoryStats,
} from "../controllers/categoryController.js";
import { validateRequest } from "../middlewares/validation.js";
import {
  createCategoryValidation,
  updateCategoryValidation,
  searchCategoryValidation,
  paginationValidation,
  getSubcategoriesValidation,
  getCategoryByIdValidation,
  deleteCategoryValidation,
} from "../validations/categories.js";

const router = express.Router();

// Public routes
// Get all categories with pagination
router.get("/", validateRequest(paginationValidation), getAllCategories);

// Get category tree structure
router.get("/tree", getCategoryTree);

// Search categories
router.get(
  "/search",
  validateRequest(searchCategoryValidation),
  searchCategories,
);

// Get category statistics
router.get("/stats", getCategoryStats);

// Get subcategories of a category
router.get(
  "/:id/subcategories",
  validateRequest(getSubcategoriesValidation),
  getSubcategories,
);

// Get category by ID
router.get(
  "/id/:id",
  validateRequest(getCategoryByIdValidation),
  getCategoryById,
);

// Get category by slug (must be last to avoid conflicts)
router.get("/:slug", getCategoryBySlug);

// Admin routes
// Create new category
router.post("/", validateRequest(createCategoryValidation), createCategory);

// Update category
router.put("/:id", validateRequest(updateCategoryValidation), updateCategory);

// Delete category
router.delete(
  "/:id",
  validateRequest(deleteCategoryValidation),
  deleteCategory,
);

export default router;
