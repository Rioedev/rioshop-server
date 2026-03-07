import express from "express";
import { asyncHandler, sendSuccess } from "../utils/helpers.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = express.Router();

// Get wishlist
router.get(
  "/",
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, { items: [] }, "Wishlist retrieved");
  }),
);

// Add to wishlist
router.post(
  "/add",
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, 201, {}, "Item added to wishlist");
  }),
);

// Remove from wishlist
router.delete(
  "/:productId",
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Item removed from wishlist");
  }),
);

export default router;
