import { asyncHandler } from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import categoryService from "../services/category.service.js";
import { SUCCESS_MESSAGES } from "../config/constants.js";

/**
 * Create new category
 * POST /api/categories/add
 */
export const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body, req.file);
  return ApiResponse.created(res, category, SUCCESS_MESSAGES.CATEGORY_CREATED);
});

/**
 * Get all categories with pagination
 * GET /api/categories?page=1&limit=10&search=...&status=...
 */
export const getCategories = asyncHandler(async (req, res) => {
  const result = await categoryService.getCategories(req.query);
  return ApiResponse.success(res, result);
});

/**
 * Get category tree (hierarchical structure)
 * GET /api/categories/tree
 */
export const getCategoryTree = asyncHandler(async (req, res) => {
  const tree = await categoryService.getCategoryTree();
  return ApiResponse.success(res, tree);
});

/**
 * Get category by ID
 * GET /api/categories/:id
 */
export const getCategoryById = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.id);
  return ApiResponse.success(res, category);
});

/**
 * Update category
 * PUT /api/categories/:id
 */
export const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(
    req.params.id,
    req.body,
    req.file,
  );
  return ApiResponse.success(res, category, SUCCESS_MESSAGES.CATEGORY_UPDATED);
});

/**
 * Soft delete category (mark as deleted)
 * PATCH /api/categories/:id/soft-delete
 */
export const softDeleteCategory = asyncHandler(async (req, res) => {
  const result = await categoryService.softDeleteCategory(req.params.id);
  return ApiResponse.success(res, result, SUCCESS_MESSAGES.CATEGORY_DELETED);
});

/**
 * Hard delete category (permanently remove)
 * DELETE /api/categories/:id
 */
export const hardDeleteCategory = asyncHandler(async (req, res) => {
  const result = await categoryService.hardDeleteCategory(req.params.id);
  return ApiResponse.success(res, result);
});
