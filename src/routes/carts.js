import express from "express";
import { asyncHandler, sendSuccess } from "../utils/helpers.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = express.Router();

// Get cart
router.get(
  "/",
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Cart retrieved");
  }),
);

// Add to cart
router.post(
  "/add",
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, 201, {}, "Item added to cart");
  }),
);

// Update cart item
router.put(
  "/items/:itemId",
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Cart item updated");
  }),
);

// Remove from cart
router.delete(
  "/items/:itemId",
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Item removed from cart");
  }),
);

// Apply coupon
router.post(
  "/apply-coupon",
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Coupon applied");
  }),
);

export default router;
