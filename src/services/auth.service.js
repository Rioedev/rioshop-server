import User from "../models/user.model.js";
import generateToken from "../utils/generateToken.js";
import { ApiError, throwError } from "../utils/asyncHandler.js";
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "../config/constants.js";

/**
 * Authentication Service
 * Handles all auth-related business logic
 */
class AuthService {
  /**
   * Register new user
   */
  async register(userData) {
    const { name, email, password } = userData;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throwError(HTTP_STATUS.CONFLICT, ERROR_MESSAGES.EMAIL_EXISTS);
    }

    // Create new user
    const user = await User.create({ name, email, password });

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    };
  }

  /**
   * Login user
   */
  async login(credentials) {
    const { email, password } = credentials;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      throwError(HTTP_STATUS.UNAUTHORIZED, ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    const user = await User.findById(userId).select("-password");
    if (!user) {
      throwError(HTTP_STATUS.NOT_FOUND, "User not found");
    }
    return user;
  }
}

export default new AuthService();
