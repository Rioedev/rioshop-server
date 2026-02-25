// routes/category.routes.js
import express from "express";
import {
  createCategory,
  getCategories,
  getCategoryTree,
  updateCategory,
  softDeleteCategory,
  hardDeleteCategory
} from "../controllers/category.controller.js";

import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", getCategories);
router.get("/tree", getCategoryTree);

router.post("/", authMiddleware, createCategory);
router.put("/:id", authMiddleware, updateCategory);
router.patch("/:id/soft-delete", authMiddleware, softDeleteCategory);
router.delete("/:id", authMiddleware, hardDeleteCategory);

export default router;