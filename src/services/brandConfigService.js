import BrandConfig from "../models/BrandConfig.js";
import { AppError } from "../utils/helpers.js";

export class BrandConfigService {
  async getBrandConfig(brandKey) {
    try {
      return await BrandConfig.findOne({ brandKey });
    } catch (error) {
      throw error;
    }
  }

  async getAllBrandConfigs(options = {}) {
    const { page = 1, limit = 20, sort = { updatedAt: -1 } } = options;

    try {
      const skip = (page - 1) * limit;
      const [docs, totalDocs] = await Promise.all([
        BrandConfig.find().sort(sort).skip(skip).limit(limit),
        BrandConfig.countDocuments(),
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

  async createBrandConfig(data) {
    try {
      const existing = await BrandConfig.findOne({ brandKey: data.brandKey });
      if (existing) {
        throw new AppError("Brand config already exists", 409);
      }

      const config = new BrandConfig({
        ...data,
        updatedAt: new Date(),
      });
      await config.save();

      return config;
    } catch (error) {
      throw error;
    }
  }

  async updateBrandConfig(brandKey, data) {
    try {
      const updateData = {
        ...data,
        updatedAt: new Date(),
      };

      return await BrandConfig.findOneAndUpdate(
        { brandKey },
        updateData,
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      );
    } catch (error) {
      throw error;
    }
  }

  async deleteBrandConfig(brandKey) {
    try {
      return await BrandConfig.findOneAndDelete({ brandKey });
    } catch (error) {
      throw error;
    }
  }
}

export default new BrandConfigService();
