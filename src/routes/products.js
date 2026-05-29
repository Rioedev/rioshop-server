import express from "express";
import multer from "multer";
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

// Export products to XLSX
router.get("/export-xlsx", validateRequest(paginationValidation), exportProductsXlsx);

// Download products XLSX import template
router.get("/import-template-xlsx", downloadProductsImportTemplateXlsx);

// Import products from XLSX
router.post("/import-xlsx", uploadXlsx.single("file"), importProductsXlsx);

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
