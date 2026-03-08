import User from "../models/User.js";
import Order from "../models/Order.js";
import Review from "../models/Review.js";
import { AppError } from "../utils/helpers.js";

export class UserService {
  async getUserProfile(userId) {
    try {
      const user = await User.findById(userId).select("-passwordHash -oauthProviders");
      if (!user) {
        throw new AppError("User not found", 404);
      }

      return user;
    } catch (error) {
      throw error;
    }
  }

  async updateUserProfile(userId, data) {
    const allowedFields = [
      "fullName",
      "avatar",
      "gender",
      "dateOfBirth",
      "addresses",
      "defaultAddressId",
      "preferences",
      "tags",
      "phone",
      "email",
    ];

    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      const updateData = {};
      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          updateData[field] = data[field];
        }
      }

      if (updateData.email && updateData.email !== user.email) {
        const existingByEmail = await User.findOne({
          email: updateData.email.toLowerCase(),
          _id: { $ne: userId },
        });

        if (existingByEmail) {
          throw new AppError("Email already in use", 409);
        }

        updateData.email = updateData.email.toLowerCase();
        updateData.emailVerified = false;
      }

      if (updateData.phone && updateData.phone !== user.phone) {
        const existingByPhone = await User.findOne({
          phone: updateData.phone,
          _id: { $ne: userId },
        });

        if (existingByPhone) {
          throw new AppError("Phone already in use", 409);
        }

        updateData.phoneVerified = false;
      }

      updateData.updatedAt = new Date();

      const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
      }).select("-passwordHash -oauthProviders");

      return updatedUser;
    } catch (error) {
      throw error;
    }
  }

  async getUserOrders(userId, filters = {}, options = {}) {
    const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;

    try {
      return await Order.paginate(
        { userId, ...filters },
        {
          page,
          limit,
          sort,
          populate: [
            { path: "paymentId" },
            { path: "shipmentId" },
            { path: "items.productId", select: "_id name slug" },
          ],
        },
      );
    } catch (error) {
      throw error;
    }
  }

  async getUserReviews(userId, filters = {}, options = {}) {
    const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;

    try {
      return await Review.paginate(
        { userId, ...filters },
        {
          page,
          limit,
          sort,
          populate: [{ path: "productId", select: "_id name slug media" }],
        },
      );
    } catch (error) {
      throw error;
    }
  }

  async updateLoyaltyPoints(userId, delta, reason = "manual_adjustment") {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      const value = Number(delta || 0);
      const currentPoints = user.loyalty?.points || 0;
      const newPoints = Math.max(0, currentPoints + value);
      const lifetimePoints = (user.loyalty?.lifetimePoints || 0) + Math.max(0, value);

      user.loyalty.points = newPoints;
      user.loyalty.lifetimePoints = lifetimePoints;
      user.loyalty.pointsHistory = user.loyalty.pointsHistory || [];
      user.loyalty.pointsHistory.push({
        delta: value,
        reason,
        date: new Date(),
      });
      user.updatedAt = new Date();

      await user.save();
      return user;
    } catch (error) {
      throw error;
    }
  }
}

export default new UserService();
