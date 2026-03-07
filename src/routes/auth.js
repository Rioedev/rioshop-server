import express from "express";
import {
  register,
  login,
  logout,
  getCurrentUser,
  refreshToken,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
} from "../controllers/authController.js";
import { authenticateToken } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validation.js";
import {
  registerValidation,
  loginValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} from "../validations/auth.js";

const router = express.Router();

// Public routes
// Register
router.post("/register", validateRequest(registerValidation), register);

// User login
router.post("/login", validateRequest(loginValidation), login);

// Forgot password
router.post(
  "/forgot-password",
  validateRequest(forgotPasswordValidation),
  forgotPassword,
);

// Reset password
router.post(
  "/reset-password",
  validateRequest(resetPasswordValidation),
  resetPassword,
);

// Protected routes
// Get current user
router.get("/me", authenticateToken, getCurrentUser);

// Logout
router.post("/logout", authenticateToken, logout);

// Refresh token
router.post("/refresh-token", authenticateToken, refreshToken);

// Change password
router.post(
  "/change-password",
  authenticateToken,
  validateRequest(changePasswordValidation),
  changePassword,
);

// Verify email
router.post("/verify-email", authenticateToken, verifyEmail);

export default router;
