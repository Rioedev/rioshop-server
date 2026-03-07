import { asyncHandler, sendSuccess, sendError } from "../utils/helpers.js";
import authService from "../services/authService.js";
import User from "../models/User.js";

/**
 * POST /api/auth/register
 * Register new user
 */
export const register = asyncHandler(async (req, res) => {
  const { email, phone, password, confirmPassword, fullName } = req.body;

  // Validate inputs
  if (!email || !phone || !password || !fullName) {
    return sendError(res, 400, "All fields are required");
  }

  if (password !== confirmPassword) {
    return sendError(res, 400, "Passwords do not match");
  }

  if (password.length < 6) {
    return sendError(res, 400, "Password must be at least 6 characters");
  }

  // Register user
  const result = await authService.registerUser({
    email,
    phone,
    password,
    fullName,
  });

  sendSuccess(res, 201, result, "User registered successfully");
});

/**
 * POST /api/auth/login
 * Login user
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate inputs
  if (!email || !password) {
    return sendError(res, 400, "Email and password are required");
  }

  // Login user
  const result = await authService.loginUser(email, password);

  sendSuccess(res, 200, result, "Login successful");
});

/**
 * POST /api/auth/logout
 * Logout user
 */
export const logout = asyncHandler(async (req, res) => {
  const { userId } = req.user; // From JWT token
  const token = req.headers.authorization?.split(" ")[1];

  if (userId && token) {
    await authService.logoutUser(userId, token);
  }

  sendSuccess(res, 200, {}, "Logout successful");
});

/**
 * GET /api/auth/me
 * Get current user info
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  const { userId } = req.user;

  const user = await User.findById(userId).select(
    "-passwordHash -oauthProviders",
  );

  if (!user) {
    return sendError(res, 404, "User not found");
  }

  sendSuccess(res, 200, user, "User fetched successfully");
});

/**
 * POST /api/auth/refresh-token
 * Refresh token
 */
export const refreshToken = asyncHandler(async (req, res) => {
  const { userId } = req.user;

  const result = await authService.refreshToken(userId);

  sendSuccess(res, 200, result, "Token refreshed successfully");
});

/**
 * POST /api/auth/change-password
 * Change password
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const { oldPassword, newPassword, confirmPassword } = req.body;

  // Validate inputs
  if (!oldPassword || !newPassword) {
    return sendError(res, 400, "Old and new passwords are required");
  }

  if (newPassword !== confirmPassword) {
    return sendError(res, 400, "Passwords do not match");
  }

  if (newPassword.length < 6) {
    return sendError(res, 400, "Password must be at least 6 characters");
  }

  await authService.changePassword(userId, oldPassword, newPassword, false);

  sendSuccess(res, 200, {}, "Password changed successfully");
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return sendError(res, 400, "Email is required");
  }

  await authService.requestPasswordReset(email);

  sendSuccess(res, 200, {}, "Password reset link sent to email");
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { userId, resetToken, newPassword, confirmPassword } = req.body;

  // Validate inputs
  if (!userId || !resetToken || !newPassword) {
    return sendError(res, 400, "All fields are required");
  }

  if (newPassword !== confirmPassword) {
    return sendError(res, 400, "Passwords do not match");
  }

  if (newPassword.length < 6) {
    return sendError(res, 400, "Password must be at least 6 characters");
  }

  await authService.resetPassword(userId, resetToken, newPassword);

  sendSuccess(res, 200, {}, "Password reset successfully");
});

/**
 * POST /api/auth/verify-email
 * Verify email
 */
export const verifyEmail = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const { emailVerificationCode } = req.body;

  // In production, verify the code
  const user = await User.findByIdAndUpdate(
    userId,
    { emailVerified: true },
    { new: true },
  );

  sendSuccess(res, 200, user, "Email verified successfully");
});
