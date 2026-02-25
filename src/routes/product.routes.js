import express from "express";
const router = express.Router();

import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  softDeleteProduct,
  restoreProduct,
  hardDeleteProduct
} from "../controllers/product.controller.js";

import authMiddleware from "../middlewares/auth.middleware.js";

/**
 * ===============================
 * PUBLIC ROUTES
 * ===============================
 */

// Lấy danh sách sản phẩm
router.get("/", getAllProducts);

// Lấy chi tiết sản phẩm
router.get("/:id", getProductById);


/**
 * ===============================
 * AUTH REQUIRED ROUTES
 * ===============================
 */

// Tạo sản phẩm
router.post("/", authMiddleware, createProduct);

// Cập nhật sản phẩm
router.put("/:id", authMiddleware, updateProduct);

// Soft delete
router.patch("/:id/soft-delete", authMiddleware, softDeleteProduct);

// Restore
router.patch("/:id/restore", authMiddleware, restoreProduct);

// Hard delete
router.delete("/:id", authMiddleware, hardDeleteProduct);

export default router;