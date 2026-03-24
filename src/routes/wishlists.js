import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validation.js";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
} from "../controllers/wishlistController.js";
import {
  addWishlistItemValidation,
  removeWishlistItemValidation,
} from "../validations/wishlists.js";

const router = express.Router();

// Get wishlist
router.get("/", authenticateToken, getWishlist);

// Add to wishlist
router.post(
  "/add",
  authenticateToken,
  validateRequest(addWishlistItemValidation),
  addToWishlist,
);

// Clear wishlist
router.delete("/clear", authenticateToken, clearWishlist);

// Remove from wishlist
router.delete(
  "/:productId",
  authenticateToken,
  validateRequest(removeWishlistItemValidation),
  removeFromWishlist,
);

export default router;
