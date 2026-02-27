// routes/category.routes.js
import express from "express";
import {
  createCategory,
  getCategories,
  getCategoryTree,
  getCategoryById,
  updateCategory,
  softDeleteCategory,
  hardDeleteCategory
} from "../controllers/category.controller.js";

import authMiddleware from "../middlewares/auth.middleware.js";
import upload from "../middlewares/upload.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  createCategorySchema,
  updateCategorySchema
} from "../validations/category.validation.js";

const router = express.Router();


// ===== PUBLIC =====
router.get("/", getCategories);
router.get("/tree", getCategoryTree);
router.get("/:id", getCategoryById);


// ===== CẦN ĐĂNG NHẬP =====
router.post(
  "/",
  authMiddleware,
  upload.single("image"),
  validate(createCategorySchema),
  createCategory
);

router.put(
  "/:id",
  authMiddleware,
  upload.single("image"),
  validate(updateCategorySchema),
  updateCategory
);

router.patch(
  "/:id/soft-delete",
  authMiddleware,
  softDeleteCategory
);

router.delete(
  "/:id",
  authMiddleware,
  hardDeleteCategory
);

export default router;