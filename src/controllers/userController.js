import {
  asyncHandler,
  sendSuccess,
  getPaginationParams,
} from "../utils/helpers.js";
import userService from "../services/userService.js";

export const getUserProfile = asyncHandler(async (req, res) => {
  const profile = await userService.getUserProfile(req.user.userId);
  sendSuccess(res, 200, profile, "Profile retrieved");
});

export const updateUserProfile = asyncHandler(async (req, res) => {
  const profile = await userService.updateUserProfile(req.user.userId, req.body);
  sendSuccess(res, 200, profile, "Profile updated successfully");
});

export const getUserOrders = asyncHandler(async (req, res) => {
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);
  const orders = await userService.getUserOrders(req.user.userId, {}, { page, limit });
  sendSuccess(res, 200, orders, "Orders retrieved");
});

export const getUserReviews = asyncHandler(async (req, res) => {
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);
  const reviews = await userService.getUserReviews(req.user.userId, {}, { page, limit });
  sendSuccess(res, 200, reviews, "Reviews retrieved");
});
