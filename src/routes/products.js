import express from "express";
import multer from "multer";
import { validateRequest } from "../middlewares/validation.js";
import {
  getAllProducts,
  exportProductsCsv,
  downloadProductsImportTemplateCsv,
  importProductsCsv,
  getProductBySlug,
  searchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  getRelatedProducts,
} from "../controllers/productController.js";
import {
  createProductValidation,
  updateProductValidation,
  paginationValidation,
  searchProductsValidation,
  productIdValidation,
  productSlugValidation,
  relatedProductsValidation,
} from "../validations/products.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});
const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

// Get all products
router.get("/", validateRequest(paginationValidation), getAllProducts);

// Search products
router.get("/search", validateRequest(searchProductsValidation), searchProducts);

// Export products to CSV
router.get("/export-csv", validateRequest(paginationValidation), exportProductsCsv);

// Download products CSV import template
router.get("/import-template-csv", downloadProductsImportTemplateCsv);

// Import products from CSV
router.post("/import-csv", uploadCsv.single("file"), importProductsCsv);

// Create product
router.post("/", validateRequest(createProductValidation), createProduct);

// Upload product image
router.post("/upload-image", upload.single("file"), uploadProductImage);

// Get related products
router.get("/:id/related", validateRequest(relatedProductsValidation), getRelatedProducts);

// Update product
router.put("/:id", validateRequest(productIdValidation), validateRequest(updateProductValidation), updateProduct);

// Soft delete product
router.delete("/:id", validateRequest(productIdValidation), deleteProduct);

// Get product by slug
router.get("/:slug", validateRequest(productSlugValidation), getProductBySlug);

export default router;
