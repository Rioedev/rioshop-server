import express from "express";
import multer from "multer";
import { authenticateToken } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validation.js";
import {
  getAllProducts,
  exportProductsXlsx,
  downloadProductsImportTemplateXlsx,
  importProductsXlsx,
  getProductBySlug,
  searchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  getRelatedProducts,
  getCartRecommendations,
} from "../controllers/productController.js";
import {
  createProductValidation,
  updateProductValidation,
  paginationValidation,
  searchProductsValidation,
  productIdValidation,
  productSlugValidation,
  relatedProductsValidation,
  cartRecommendationsValidation,
} from "../validations/products.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});
const XLSX_UPLOAD_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "application/octet-stream",
]);
const uploadXlsx = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const fileName = file.originalname || "";
    if (XLSX_UPLOAD_MIME.has(file.mimetype) || /\.xlsx$/i.test(fileName)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only .xlsx files are allowed"));
  },
});

// Get all products
router.get("/", validateRequest(paginationValidation), getAllProducts);

// Search products
router.get("/search", validateRequest(searchProductsValidation), searchProducts);

// Recommend products that complement the current cart (public)
router.post(
  "/cart-recommendations",
  validateRequest(cartRecommendationsValidation),
  getCartRecommendations,
);

// Export products to XLSX (admin)
router.get("/export-xlsx", authenticateToken, validateRequest(paginationValidation), exportProductsXlsx);

// Download products XLSX import template (admin)
router.get("/import-template-xlsx", authenticateToken, downloadProductsImportTemplateXlsx);

// Import products from XLSX (admin)
router.post("/import-xlsx", authenticateToken, uploadXlsx.single("file"), importProductsXlsx);

// Create product (admin)
router.post("/", authenticateToken, validateRequest(createProductValidation), createProduct);

// Upload product image (admin)
router.post("/upload-image", authenticateToken, upload.single("file"), uploadProductImage);

// Get related products (public)
router.get("/:id/related", validateRequest(relatedProductsValidation), getRelatedProducts);

// Update product (admin)
router.put("/:id", authenticateToken, validateRequest(productIdValidation), validateRequest(updateProductValidation), updateProduct);

// Soft delete product (admin)
router.delete("/:id", authenticateToken, validateRequest(productIdValidation), deleteProduct);

// Get product by slug
router.get("/:slug", validateRequest(productSlugValidation), getProductBySlug);

export default router;
