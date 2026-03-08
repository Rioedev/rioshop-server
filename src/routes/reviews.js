import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validation.js";
import {
  getReviewsForProduct,
  createReview,
  updateReview,
  deleteReview,
} from "../controllers/reviewController.js";
import {
  getProductReviewsValidation,
  createReviewValidation,
  reviewIdValidation,
  updateReviewValidation,
} from "../validations/reviews.js";

const router = express.Router();

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
