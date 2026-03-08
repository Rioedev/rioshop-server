import bcrypt from "bcryptjs";
import Admin from "../models/Admin.js";
import { AppError } from "../utils/helpers.js";

export class AdminService {
  async getAllAdmins(filters = {}, options = {}) {
    const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;

    try {
      const skip = (page - 1) * limit;
      const query = { ...filters };

      const [admins, totalDocs] = await Promise.all([
        Admin.find(query).select("-passwordHash").sort(sort).skip(skip).limit(limit),
        Admin.countDocuments(query),
      ]);

      return {
        docs: admins,
        totalDocs,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalDocs / limit)),
        hasPrevPage: page > 1,
        hasNextPage: skip + admins.length < totalDocs,
      };
    } catch (error) {
      throw error;
    }
  }

  async getAdminById(id) {
    try {
      return await Admin.findById(id).select("-passwordHash");
    } catch (error) {
      throw error;
    }
  }

  async createAdmin(data) {
    try {
      const existing = await Admin.findOne({ email: data.email.toLowerCase() });
      if (existing) {
        throw new AppError("Admin email already exists", 409);
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(data.password, salt);

      const admin = new Admin({
        ...data,
        email: data.email.toLowerCase(),
        passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await admin.save();

      return await this.getAdminById(admin._id);
    } catch (error) {
      throw error;
    }
  }

  async updateAdmin(id, data) {
    try {
      const admin = await Admin.findById(id);
      if (!admin) {
        throw new AppError("Admin not found", 404);
      }

      const updateData = { ...data };

      if (updateData.email && updateData.email.toLowerCase() !== admin.email) {
        const existingByEmail = await Admin.findOne({
          email: updateData.email.toLowerCase(),
          _id: { $ne: id },
        });

        if (existingByEmail) {
          throw new AppError("Admin email already exists", 409);
        }

        updateData.email = updateData.email.toLowerCase();
      }

      if (updateData.password) {
        const salt = await bcrypt.genSalt(10);
        updateData.passwordHash = await bcrypt.hash(updateData.password, salt);
        delete updateData.password;
      }

      updateData.updatedAt = new Date();

      return await Admin.findByIdAndUpdate(id, updateData, { new: true }).select(
        "-passwordHash",
      );
    } catch (error) {
      throw error;
    }
  }

  async deleteAdmin(id, actorId = null) {
    try {
      if (actorId && id.toString() === actorId.toString()) {
        throw new AppError("Cannot delete your own admin account", 400);
      }

      return await Admin.findByIdAndDelete(id);
    } catch (error) {
      throw error;
    }
  }

  async changeAdminStatus(id, isActive) {
    try {
      return await Admin.findByIdAndUpdate(
        id,
        { isActive: Boolean(isActive), updatedAt: new Date() },
        { new: true },
      ).select("-passwordHash");
    } catch (error) {
      throw error;
    }
  }
}

export default new AdminService();
