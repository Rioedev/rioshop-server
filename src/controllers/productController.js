import {
  asyncHandler,
  sendSuccess,
  sendError,
  getPaginationParams,
} from "../utils/helpers.js";
import Product from "../models/Product.js";
import productService from "../services/productService.js";

export const getAllProducts = asyncHandler(async (req, res) => {
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);
  const { category, gender, minPrice, maxPrice, sort } = req.query;

  const filters = { status: "active" };
  if (category) filters["category._id"] = category;
  if (gender) filters.gender = gender;
  if (minPrice || maxPrice) {
    filters["pricing.salePrice"] = {};
    if (minPrice) filters["pricing.salePrice"].$gte = parseInt(minPrice);
    if (maxPrice) filters["pricing.salePrice"].$lte = parseInt(maxPrice);
  }

  const products = await productService.getAllProducts(filters, {
    page,
    limit,
    sort: sort ? JSON.parse(sort) : { createdAt: -1 },
  });

  sendSuccess(res, 200, products, "Products fetched successfully");
});

export const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await productService.getProductBySlug(req.params.slug);

  if (!product) {
    return sendError(res, 404, "Product not found");
  }

  // Increment view count asynchronously
  await productService.updateProduct(product._id, {
    viewCount: (product.viewCount || 0) + 1,
  });

  sendSuccess(res, 200, product, "Product fetched successfully");
});

export const searchProducts = asyncHandler(async (req, res) => {
  const { q, page, limit } = req.query;

  if (!q || q.trim().length === 0) {
    return sendError(res, 400, "Search query is required");
  }

  const { page: pageNum, limit: limitNum } = getPaginationParams(page, limit);
  const products = await productService.searchProducts(
    q,
    {},
    {
      page: pageNum,
      limit: limitNum,
    },
  );

  sendSuccess(res, 200, products, "Products searched successfully");
});

export const createProduct = asyncHandler(async (req, res) => {
  // Typically called by admin only
  const product = await productService.createProduct(req.body);
  sendSuccess(res, 201, product, "Product created successfully");
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.body);
  sendSuccess(res, 200, product, "Product updated successfully");
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await productService.deleteProduct(req.params.id);
  sendSuccess(res, 200, product, "Product deleted successfully");
});

export const getRelatedProducts = asyncHandler(async (req, res) => {
  const relatedProducts = await productService.getRelatedProducts(
    req.params.id,
    6,
  );
  sendSuccess(res, 200, relatedProducts, "Related products fetched");
});
