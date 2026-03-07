import Category from "../models/Category.js";
import { CACHE_KEYS, CACHE_TTL } from "../constants/index.js";
import { redisClient } from "../config/redis.js";

export class CategoryService {
  async getAllCategories(filters = {}, options = {}) {
    const { page = 1, limit = 10, sort = { position: 1, name: 1 } } = options;

    try {
      const query = Category.paginate(
        { isActive: true, ...filters },
        {
          page,
          limit,
          sort,
          populate: [
            {
              path: "parentId",
              select: "name slug",
            },
          ],
        },
      );

      return await query;
    } catch (error) {
      throw error;
    }
  }

  async getCategoryBySlug(slug) {
    try {
      const cacheKey = `${CACHE_KEYS.CATEGORY}${slug}`;

      // Try to get from cache
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get from database
      const category = await Category.findOne({
        slug,
        isActive: true,
      }).populate([
        {
          path: "parentId",
          select: "name slug _id",
        },
      ]);

      if (!category) {
        return null;
      }

      // Cache it
      await redisClient.setEx(
        cacheKey,
        CACHE_TTL.LONG,
        JSON.stringify(category),
      );

      return category;
    } catch (error) {
      throw error;
    }
  }

  async getCategoryById(id) {
    try {
      const category = await Category.findById(id).populate([
        {
          path: "parentId",
          select: "name slug _id",
        },
      ]);
      return category;
    } catch (error) {
      throw error;
    }
  }

  async getCategoryTree(parentId = null) {
    try {
      const cacheKey = `${CACHE_KEYS.CATEGORY}tree:${parentId || "root"}`;

      // Try to get from cache
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get categories
      const categories = await Category.find({
        parentId: parentId ? parentId : { $exists: false },
        isActive: true,
      }).sort({ position: 1, name: 1 });

      // Build tree recursively
      const tree = await Promise.all(
        categories.map(async (category) => {
          const children = await this.getCategoryTree(category._id);
          return {
            ...category.toObject(),
            children,
          };
        }),
      );

      // Cache it
      await redisClient.setEx(cacheKey, CACHE_TTL.MEDIUM, JSON.stringify(tree));

      return tree;
    } catch (error) {
      throw error;
    }
  }

  async getSubcategories(parentId, limit = 50) {
    try {
      const subcategories = await Category.find({
        parentId,
        isActive: true,
      })
        .sort({ position: 1, name: 1 })
        .limit(limit);

      return subcategories;
    } catch (error) {
      throw error;
    }
  }

  async createCategory(data) {
    try {
      // Handle parent category if provided
      if (data.parentId) {
        const parentCategory = await Category.findById(data.parentId);
        if (!parentCategory) {
          throw new Error("Parent category not found");
        }

        // Set level and ancestors
        data.level = (parentCategory.level || 0) + 1;
        data.ancestors = [
          ...(parentCategory.ancestors || []),
          {
            _id: parentCategory._id,
            name: parentCategory.name,
            slug: parentCategory.slug,
          },
        ];

        // Build path
        const ancestorSlugs = data.ancestors.map((a) => a.slug);
        data.path = [...ancestorSlugs, data.slug].join("/");
      } else {
        // Root category
        data.level = 0;
        data.ancestors = [];
        data.path = data.slug;
      }

      const category = new Category(data);
      await category.save();

      // Invalidate tree cache
      await this.invalidateTreeCache(data.parentId);

      return category;
    } catch (error) {
      throw error;
    }
  }

  async updateCategory(id, data) {
    try {
      const category = await Category.findByIdAndUpdate(id, data, {
        new: true,
      }).populate([
        {
          path: "parentId",
          select: "name slug _id",
        },
      ]);

      if (!category) {
        return null;
      }

      // Invalidate cache
      const cacheKey = `${CACHE_KEYS.CATEGORY}${category.slug}`;
      await redisClient.del(cacheKey);

      // Invalidate tree cache
      await this.invalidateTreeCache(category.parentId);

      return category;
    } catch (error) {
      throw error;
    }
  }

  async deleteCategory(id) {
    try {
      const category = await Category.findByIdAndDelete(id);

      if (!category) {
        return null;
      }

      // Invalidate cache
      const cacheKey = `${CACHE_KEYS.CATEGORY}${category.slug}`;
      await redisClient.del(cacheKey);

      // Invalidate tree cache
      await this.invalidateTreeCache(category.parentId);

      return category;
    } catch (error) {
      throw error;
    }
  }

  async invalidateTreeCache(parentId = null) {
    try {
      const cacheKey = `${CACHE_KEYS.CATEGORY}tree:${parentId || "root"}`;
      await redisClient.del(cacheKey);
    } catch (error) {
      console.error("Cache invalidation error:", error);
    }
  }

  async searchCategories(query, filters = {}, options = {}) {
    try {
      const { page = 1, limit = 10 } = options;
      const { page: pageNum, limit: limitNum } = {
        page,
        limit,
      };

      const searchQuery = {
        $or: [
          { name: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
        ],
        isActive: true,
        ...filters,
      };

      const categories = await Category.paginate(searchQuery, {
        page: pageNum,
        limit: limitNum,
      });

      return categories;
    } catch (error) {
      throw error;
    }
  }

  async getCategoryStats() {
    try {
      const stats = await Category.aggregate([
        {
          $match: { isActive: true },
        },
        {
          $facet: {
            total: [{ $count: "count" }],
            byLevel: [
              {
                $group: {
                  _id: "$level",
                  count: { $sum: 1 },
                },
              },
              {
                $sort: { _id: 1 },
              },
            ],
            rootCategories: [
              {
                $match: { level: 0 },
              },
              {
                $count: "count",
              },
            ],
          },
        },
      ]);

      return stats[0] || {};
    } catch (error) {
      throw error;
    }
  }
}

export default new CategoryService();
