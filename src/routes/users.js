import express from "express";
import { asyncHandler, sendSuccess } from "../utils/helpers.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = express.Router();

// Get user profile
router.get(
  "/profile",
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, { userId: req.user.id }, "Profile retrieved");
  }),
);

// Update user profile
router.put(
  "/profile",
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Profile updated successfully");
  }),
);

// Get user orders
router.get(
  "/orders",
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, [], "Orders retrieved");
  }),
);

// Get user reviews
router.get(
  "/reviews",
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, [], "Reviews retrieved");
  }),
);

export default router;
