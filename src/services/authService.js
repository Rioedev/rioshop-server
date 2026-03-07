import User from "../models/User.js";
import Admin from "../models/Admin.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { generateToken } from "../middlewares/auth.js";
import { redisClient } from "../config/redis.js";
import { AppError } from "../utils/helpers.js";
import dotenv from "dotenv";

dotenv.config();

export class AuthService {
  /**
   * Register new user
   */
  async registerUser(data) {
    const { email, phone, password, fullName } = data;

    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { phone }],
      });

      if (existingUser) {
        throw new AppError(
          existingUser.email === email
            ? "Email already registered"
            : "Phone already registered",
          400,
        );
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Create user
      const user = new User({
        email: email.toLowerCase(),
        phone,
        passwordHash,
        fullName,
        emailVerified: false,
        phoneVerified: false,
        status: "active",
      });

      await user.save();

      // Generate token
      const token = generateToken({
        userId: user._id.toString(),
        role: "user",
      });

      return {
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
        },
        token,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Login user
   */
  async loginUser(email, password) {
    try {
      // Find user
      const user = await User.findOne({
        email: email.toLowerCase(),
      });

      if (!user) {
        throw new AppError("Email or password incorrect", 401);
      }

      // Check if user is active
      if (user.status !== "active") {
        throw new AppError("Account is not active", 403);
      }

      // Compare password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

      if (!isPasswordValid) {
        throw new AppError("Email or password incorrect", 401);
      }

      // Update last login
      user.lastLoginAt = new Date();
      user.loginCount = (user.loginCount || 0) + 1;
      await user.save();

      // Generate token
      const token = generateToken({
        userId: user._id.toString(),
        role: "user",
      });

      return {
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
        },
        token,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Register admin user
   */
  async registerAdmin(data) {
    const {
      email,
      password,
      fullName,
      role = "manager",
      permissions = [],
    } = data;

    try {
      // Check if admin already exists
      const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });

      if (existingAdmin) {
        throw new AppError("Email already registered as admin", 400);
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Create admin
      const admin = new Admin({
        email: email.toLowerCase(),
        passwordHash,
        fullName,
        role,
        permissions,
        isActive: true,
      });

      await admin.save();

      return {
        admin: {
          id: admin._id,
          email: admin.email,
          fullName: admin.fullName,
          role: admin.role,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Admin login
   */
  async loginAdmin(email, password) {
    try {
      // Find admin
      const admin = await Admin.findOne({
        email: email.toLowerCase(),
      });

      if (!admin) {
        throw new AppError("Email or password incorrect", 401);
      }

      // Check if admin is active
      if (!admin.isActive) {
        throw new AppError("Account is not active", 403);
      }

      // Compare password
      const isPasswordValid = await bcrypt.compare(
        password,
        admin.passwordHash,
      );

      if (!isPasswordValid) {
        throw new AppError("Email or password incorrect", 401);
      }

      // Update last login
      admin.lastLoginAt = new Date();
      admin.loginHistory = admin.loginHistory || [];
      admin.loginHistory.push({
        ip: "0.0.0.0", // Will be set by controller
        ua: "", // Will be set by controller
        at: new Date(),
      });

      // Keep only last 20 logins
      if (admin.loginHistory.length > 20) {
        admin.loginHistory = admin.loginHistory.slice(-20);
      }

      await admin.save();

      // Generate token
      const token = generateToken({
        adminId: admin._id.toString(),
        role: admin.role,
        permissions: admin.permissions,
      });

      return {
        admin: {
          id: admin._id,
          email: admin.email,
          fullName: admin.fullName,
          role: admin.role,
        },
        token,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify token and get user info
   */
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded;
    } catch (error) {
      throw new Error("Invalid token");
    }
  }

  /**
   * Logout user (invalidate token in cache)
   */
  async logoutUser(userId, token) {
    try {
      const blacklistKey = `blacklist:${userId}`;
      await redisClient.setEx(blacklistKey, 86400 * 7, token); // 7 days
      return true;
    } catch (error) {
      console.error("Logout error:", error);
      return false;
    }
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(userId, token) {
    try {
      const blacklistKey = `blacklist:${userId}`;
      const blacklistedToken = await redisClient.get(blacklistKey);
      return blacklistedToken === token;
    } catch (error) {
      return false;
    }
  }

  /**
   * Refresh token
   */
  async refreshToken(userId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new Error("User not found");
      }

      if (user.status !== "active") {
        throw new Error("Account is not active");
      }

      const token = generateToken({
        userId: user._id.toString(),
        role: "user",
      });

      return { token };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Change password
   */
  async changePassword(userId, oldPassword, newPassword, isAdmin = false) {
    try {
      const Model = isAdmin ? Admin : User;
      const user = await Model.findById(userId);

      if (!user) {
        throw new Error("User not found");
      }

      // Verify old password
      const isPasswordValid = await bcrypt.compare(
        oldPassword,
        user.passwordHash,
      );

      if (!isPasswordValid) {
        throw new Error("Current password is incorrect");
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(newPassword, salt);
      await user.save();

      return { message: "Password changed successfully" };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email) {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        // Don't reveal if email exists
        return { message: "If email exists, reset link will be sent" };
      }

      // Generate reset token
      const resetToken = require("crypto").randomBytes(32).toString("hex");
      const resetTokenHash = await bcrypt.hash(resetToken, 10);

      // Store in cache with 1 hour expiry
      const resetKey = `password_reset:${user._id}`;
      await redisClient.setEx(resetKey, 3600, resetTokenHash);

      // In real app, send email with reset link
      // For now, just return the token (NOT for production!)
      console.log(`Reset token for ${email}: ${resetToken}`);

      return { message: "Password reset link sent to email" };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(userId, resetToken, newPassword) {
    try {
      const resetKey = `password_reset:${userId}`;
      const storedHash = await redisClient.get(resetKey);

      if (!storedHash) {
        throw new Error("Reset token expired or invalid");
      }

      // Verify reset token
      const isValid = await bcrypt.compare(resetToken, storedHash);

      if (!isValid) {
        throw new Error("Invalid reset token");
      }

      // Update password
      const user = await User.findById(userId);
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(newPassword, salt);
      await user.save();

      // Clear reset token
      await redisClient.del(resetKey);

      return { message: "Password reset successfully" };
    } catch (error) {
      throw error;
    }
  }
}

export default new AuthService();
