import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validation.js";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  applyCartCoupon,
} from "../controllers/cartController.js";
import {
  addToCartValidation,
  updateCartItemValidation,
  cartItemIdValidation,
  applyCartCouponValidation,
} from "../validations/carts.js";

const router = express.Router();

// Get cart
router.get("/", authenticateToken, getCart);

// Add to cart
router.post(
  "/add",
  authenticateToken,
  validateRequest(addToCartValidation),
  addToCart,
);

// Update cart item
router.put(
  "/items/:itemId",
  authenticateToken,
  validateRequest(updateCartItemValidation),
  updateCartItem,
);

// Remove from cart
router.delete(
  "/items/:itemId",
  authenticateToken,
  validateRequest(cartItemIdValidation),
  removeCartItem,
);

// Apply coupon
router.post(
  "/apply-coupon",
  authenticateToken,
  validateRequest(applyCartCouponValidation),
  applyCartCoupon,
);

export default router;
