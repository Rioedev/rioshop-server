import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validation.js";
import {
  getUserProfile,
  updateUserProfile,
  getUserOrders,
  getUserReviews,
} from "../controllers/userController.js";
import { updateProfileValidation, userListValidation } from "../validations/users.js";

const router = express.Router();

// Get user profile
router.get("/profile", authenticateToken, getUserProfile);

// Update user profile
router.put(
  "/profile",
  authenticateToken,
  validateRequest(updateProfileValidation),
  updateUserProfile,
);

// Get user orders
router.get("/orders", authenticateToken, validateRequest(userListValidation), getUserOrders);

// Get user reviews
router.get(
  "/reviews",
  authenticateToken,
  validateRequest(userListValidation),
  getUserReviews,
);

export default router;
