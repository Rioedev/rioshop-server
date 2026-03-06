import { asyncHandler } from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import productService from "../services/product.service.js";
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from "../config/constants.js";

/**
 * Create new product
 * POST /api/products
 */
export const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body, req.files);
  return ApiResponse.created(res, product, SUCCESS_MESSAGES.PRODUCT_CREATED);
});

/**
 * Get all products with pagination
 * GET /api/products?page=1&limit=10&keyword=...&status=...
 */
export const getAllProducts = asyncHandler(async (req, res) => {
  const result = await productService.getProducts(req.query);
  return ApiResponse.success(res, result);
});

/**
 * Get product by ID
 * GET /api/products/:id
 */
export const getProductById = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.params.id);
  return ApiResponse.success(res, product);
});

/**
 * Update product
 * PUT /api/products/:id
 */
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(
    req.params.id,
    req.body,
    req.files,
  );
  return ApiResponse.success(res, product, SUCCESS_MESSAGES.PRODUCT_UPDATED);
});

/**
 * Soft delete product (mark as archived)
 * PATCH /api/products/:id/soft-delete
 */
export const softDeleteProduct = asyncHandler(async (req, res) => {
  const product = await productService.softDeleteProduct(req.params.id);
  return ApiResponse.success(res, product, SUCCESS_MESSAGES.PRODUCT_DELETED);
});

/**
 * Restore soft deleted product
 * PATCH /api/products/:id/restore
 */
export const restoreProduct = asyncHandler(async (req, res) => {
  const product = await productService.restoreProduct(req.params.id);
  return ApiResponse.success(res, product, SUCCESS_MESSAGES.PRODUCT_RESTORED);
});

/**
 * Hard delete product (permanently remove)
 * DELETE /api/products/:id
 */
export const hardDeleteProduct = asyncHandler(async (req, res) => {
  const result = await productService.hardDeleteProduct(req.params.id);
  return ApiResponse.success(res, result);
});
