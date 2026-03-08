import { asyncHandler, sendSuccess } from "../utils/helpers.js";
import wishlistService from "../services/wishlistService.js";

export const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await wishlistService.getWishlistByUser(req.user.userId);
  sendSuccess(res, 200, wishlist, "Wishlist retrieved");
});

export const addToWishlist = asyncHandler(async (req, res) => {
  const wishlist = await wishlistService.addItem(req.user.userId, req.body);
  sendSuccess(res, 201, wishlist, "Item added to wishlist");
});

export const removeFromWishlist = asyncHandler(async (req, res) => {
  const wishlist = await wishlistService.removeItem(
    req.user.userId,
    req.params.productId,
    req.query.variantSku || null,
  );
  sendSuccess(res, 200, wishlist, "Item removed from wishlist");
});
