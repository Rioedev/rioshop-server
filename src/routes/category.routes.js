// routes/category.routes.js
import express from "express";
import { upload } from "../middlewares/upload.middleware.js";
import {
  createCategory,
  getCategories,
  getCategoryTree,
  getCategoryById,
  updateCategory,
  softDeleteCategory,
  hardDeleteCategory,
} from "../controllers/category.controller.js";

const router = express.Router();

// ===== PUBLIC =====
router.get("/", getCategories);
router.get("/tree", getCategoryTree);
router.get("/:id", getCategoryById);

// ===== CẦN ĐĂNG NHẬP =====
router.post(
  "/add",
  // authMiddleware,
  upload.single("image"),
  createCategory,
);

router.put(
  "/:id",
  // authMiddleware,
  upload.single("image"),
  updateCategory,
);

router.patch(
  "/:id/soft-delete",
  // authMiddleware,
  softDeleteCategory,
);

router.delete(
  "/:id",
  // authMiddleware,
  hardDeleteCategory,
);

export default router;
