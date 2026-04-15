import express from "express";
import { authenticateToken, authorizeRole } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validation.js";
import {
  getReviews,
  getReviewsForProduct,
  createReview,
  updateReview,
  deleteReview,
} from "../controllers/reviewController.js";
import {
  getReviewsValidation,
  getProductReviewsValidation,
  createReviewValidation,
  reviewIdValidation,
  updateReviewValidation,
} from "../validations/reviews.js";

const router = express.Router();

// Get reviews (admin)
router.get(
  "/",
  authenticateToken,
  authorizeRole("superadmin", "manager", "warehouse", "sales"),
  validateRequest(getReviewsValidation),
  getReviews,
);

// Get reviews for product
router.get(
  "/product/:productId",
  validateRequest(getProductReviewsValidation),
  getReviewsForProduct,
);

// Create review
router.post("/", authenticateToken, validateRequest(createReviewValidation), createReview);

// Update review
router.put("/:id", authenticateToken, validateRequest(updateReviewValidation), updateReview);

// Delete review
router.delete("/:id", authenticateToken, validateRequest(reviewIdValidation), deleteReview);

export default router;
