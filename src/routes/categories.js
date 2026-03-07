import express from "express";
import { asyncHandler, sendSuccess } from "../utils/helpers.js";

const router = express.Router();

// Get all categories
router.get(
  "/",
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, [], "Categories retrieved successfully");
  }),
);

// Get category by slug
router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Category retrieved successfully");
  }),
);

export default router;
