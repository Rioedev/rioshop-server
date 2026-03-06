import { asyncHandler } from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import authService from "../services/auth.service.js";
import { SUCCESS_MESSAGES } from "../config/constants.js";

/**
 * Register new user
 * POST /api/auth/register
 */
export const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  return ApiResponse.created(res, user, SUCCESS_MESSAGES.REGISTER_SUCCESS);
});

/**
 * Login user
 * POST /api/auth/login
 */
export const login = asyncHandler(async (req, res) => {
  const user = await authService.login(req.body);
  return ApiResponse.success(res, user, SUCCESS_MESSAGES.LOGIN_SUCCESS);
});
