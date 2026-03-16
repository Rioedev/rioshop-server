import User from "../models/User.js";
import Order from "../models/Order.js";
import Review from "../models/Review.js";
import bcrypt from "bcryptjs";
import { AppError } from "../utils/helpers.js";

const USER_SAFE_SELECT = "-passwordHash -oauthProviders";

export class UserService {
  async getUserProfile(userId) {
    try {
      const user = await User.findById(userId).select(USER_SAFE_SELECT);
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
      }).select(USER_SAFE_SELECT);

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

  async getAllCustomers(filters = {}, options = {}) {
    const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;

    try {
      const skip = (page - 1) * limit;
      const andConditions = [];

      if (filters.status) {
        andConditions.push({ status: filters.status });
      }

      if (filters.isDeleted !== undefined) {
        andConditions.push({ isDeleted: Boolean(filters.isDeleted) });
      } else {
        andConditions.push({
          $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
        });
      }

      if (filters.search) {
        andConditions.push({
          $or: [
            { fullName: { $regex: filters.search, $options: "i" } },
            { email: { $regex: filters.search, $options: "i" } },
            { phone: { $regex: filters.search, $options: "i" } },
          ],
        });
      }

      const query = andConditions.length > 0 ? { $and: andConditions } : {};

      const [docs, totalDocs] = await Promise.all([
        User.find(query).select(USER_SAFE_SELECT).sort(sort).skip(skip).limit(limit),
        User.countDocuments(query),
      ]);

      return {
        docs,
        totalDocs,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalDocs / limit)),
        hasPrevPage: page > 1,
        hasNextPage: skip + docs.length < totalDocs,
      };
    } catch (error) {
      throw error;
    }
  }

  async getCustomerById(id) {
    try {
      const user = await User.findById(id).select(USER_SAFE_SELECT);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      return user;
    } catch (error) {
      throw error;
    }
  }

  async createCustomer(data) {
    try {
      const existing = await User.findOne({
        $or: [{ email: data.email.toLowerCase() }, { phone: data.phone }],
      });

      if (existing) {
        throw new AppError(
          existing.email === data.email.toLowerCase()
            ? "Email already registered"
            : "Phone already registered",
          409,
        );
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(data.password, salt);

      const user = new User({
        email: data.email.toLowerCase(),
        phone: data.phone,
        passwordHash,
        fullName: data.fullName,
        avatar: data.avatar,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth,
        addresses: data.addresses || [],
        defaultAddressId: data.defaultAddressId || "",
        preferences: data.preferences || {},
        tags: data.tags || [],
        status: data.status || "active",
        isDeleted: false,
        deletedAt: null,
      });

      await user.save();
      return await this.getCustomerById(user._id);
    } catch (error) {
      throw error;
    }
  }

  async updateCustomerByAdmin(userId, data) {
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
      "status",
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
        const normalizedEmail = updateData.email.toLowerCase();
        const existingByEmail = await User.findOne({
          email: normalizedEmail,
          _id: { $ne: userId },
        });

        if (existingByEmail) {
          throw new AppError("Email already in use", 409);
        }

        updateData.email = normalizedEmail;
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

      if (updateData.status === "active") {
        updateData.isDeleted = false;
        updateData.deletedAt = null;
      }

      updateData.updatedAt = new Date();

      const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
      }).select(USER_SAFE_SELECT);

      return updatedUser;
    } catch (error) {
      throw error;
    }
  }

  async updateCustomerStatus(userId, status) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      const updateData = {
        status,
        updatedAt: new Date(),
      };

      if (status === "active") {
        updateData.isDeleted = false;
        updateData.deletedAt = null;
      }

      const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
      }).select(USER_SAFE_SELECT);

      return updatedUser;
    } catch (error) {
      throw error;
    }
  }

  async softDeleteCustomer(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          status: "inactive",
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
        { new: true },
      ).select(USER_SAFE_SELECT);

      return updatedUser;
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
