import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validation.js";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  applyCartCoupon,
  clearCartCoupon,
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

// Clear cart
router.delete("/clear", authenticateToken, clearCart);

// Apply coupon
router.post(
  "/apply-coupon",
  authenticateToken,
  validateRequest(applyCartCouponValidation),
  applyCartCoupon,
);

// Clear coupon
router.delete("/coupon", authenticateToken, clearCartCoupon);

export default router;
