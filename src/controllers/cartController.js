import { asyncHandler, sendSuccess } from "../utils/helpers.js";
import cartService from "../services/cartService.js";

export const getCart = asyncHandler(async (req, res) => {
  const cart = await cartService.getCartByUser(req.user.userId);
  sendSuccess(res, 200, cart, "Cart retrieved");
});

export const addToCart = asyncHandler(async (req, res) => {
  const cart = await cartService.addItem(req.user.userId, req.body);
  sendSuccess(res, 201, cart, "Item added to cart");
});

export const updateCartItem = asyncHandler(async (req, res) => {
  const cart = await cartService.updateCartItem(
    req.user.userId,
    req.params.itemId,
    req.body,
  );

  sendSuccess(res, 200, cart, "Cart item updated");
});

export const removeCartItem = asyncHandler(async (req, res) => {
  const cart = await cartService.removeCartItem(req.user.userId, req.params.itemId);
  sendSuccess(res, 200, cart, "Item removed from cart");
});

export const clearCart = asyncHandler(async (req, res) => {
  const cart = await cartService.clearCart(req.user.userId);
  sendSuccess(res, 200, cart, "Cart cleared");
});

export const applyCartCoupon = asyncHandler(async (req, res) => {
  const { code } = req.body;
  const result = await cartService.applyCoupon(req.user.userId, code);
  sendSuccess(res, 200, result, "Coupon applied");
});
