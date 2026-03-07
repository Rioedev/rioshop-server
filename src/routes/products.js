import express from "express";
import {
  asyncHandler,
  sendSuccess,
  sendError,
  getPaginationParams,
} from "../utils/helpers.js";
import productService from "../services/productService.js";

const router = express.Router();

// Get all products
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit } = getPaginationParams(
      req.query.page,
      req.query.limit,
    );
    const { category, gender, minPrice, maxPrice, sort } = req.query;

    const filters = {};
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

    sendSuccess(res, 200, products, "Products retrieved successfully");
  }),
);

// Get product by slug
router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const product = await productService.getProductBySlug(req.params.slug);

    if (!product) {
      return sendError(res, 404, "Product not found");
    }

    // Increment view count
    await productService.updateProduct(product._id, {
      viewCount: (product.viewCount || 0) + 1,
    });

    sendSuccess(res, 200, product, "Product retrieved successfully");
  }),
);

// Search products
router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const { q, page, limit } = req.query;

    if (!q) {
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
  }),
);

// Get related products
router.get(
  "/:id/related",
  asyncHandler(async (req, res) => {
    const relatedProducts = await productService.getRelatedProducts(
      req.params.id,
      6,
    );
    sendSuccess(res, 200, relatedProducts, "Related products retrieved");
  }),
);

export default router;
