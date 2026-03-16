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

export const getAllCustomers = asyncHandler(async (req, res) => {
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);
  const filters = {
    search: req.query.search?.trim(),
    status: req.query.status,
  };

  if (req.query.isDeleted !== undefined) {
    filters.isDeleted = req.query.isDeleted === "true";
  }

  const users = await userService.getAllCustomers(filters, { page, limit });
  sendSuccess(res, 200, users, "Customers retrieved");
});

export const getCustomerById = asyncHandler(async (req, res) => {
  const user = await userService.getCustomerById(req.params.id);
  sendSuccess(res, 200, user, "Customer retrieved");
});

export const createCustomer = asyncHandler(async (req, res) => {
  const user = await userService.createCustomer(req.body);
  sendSuccess(res, 201, user, "Customer created successfully");
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const user = await userService.updateCustomerByAdmin(req.params.id, req.body);
  sendSuccess(res, 200, user, "Customer updated successfully");
});

export const updateCustomerStatus = asyncHandler(async (req, res) => {
  const user = await userService.updateCustomerStatus(req.params.id, req.body.status);
  sendSuccess(res, 200, user, "Customer status updated successfully");
});

export const softDeleteCustomer = asyncHandler(async (req, res) => {
  const user = await userService.softDeleteCustomer(req.params.id);
  sendSuccess(res, 200, user, "Customer soft deleted successfully");
});
