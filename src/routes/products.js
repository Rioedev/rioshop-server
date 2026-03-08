import express from "express";
import { validateRequest } from "../middlewares/validation.js";
import {
  getAllProducts,
  getProductBySlug,
  searchProducts,
  getRelatedProducts,
} from "../controllers/productController.js";
import {
  paginationValidation,
  searchProductsValidation,
  productSlugValidation,
  relatedProductsValidation,
} from "../validations/products.js";

const router = express.Router();

// Get all products
router.get("/", validateRequest(paginationValidation), getAllProducts);

// Search products
router.get("/search", validateRequest(searchProductsValidation), searchProducts);

// Get related products
router.get("/:id/related", validateRequest(relatedProductsValidation), getRelatedProducts);

// Get product by slug
router.get("/:slug", validateRequest(productSlugValidation), getProductBySlug);

export default router;
