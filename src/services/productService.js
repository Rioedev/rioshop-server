import Product from "../models/Product.js";
import { CACHE_KEYS, CACHE_TTL } from "../constants/index.js";
import { redisClient } from "../config/redis.js";

export class ProductService {
  async getAllProducts(filters = {}, options = {}) {
    const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;

    try {
      const queryFilters = {
        deletedAt: null,
        ...filters,
      };

      const query = Product.paginate(
        queryFilters,
        {
          page,
          limit,
          sort,
        },
      );

      return await query;
    } catch (error) {
      throw error;
    }
  }

  async getProductBySlug(slug) {
    try {
      const cacheKey = `${CACHE_KEYS.PRODUCT}${slug}`;

      // Try to get from cache
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get from database
      const product = await Product.findOne({
        slug,
        status: "active",
        deletedAt: null,
      });

      if (!product) {
        return null;
      }

      // Cache it
      await redisClient.setEx(
        cacheKey,
        CACHE_TTL.LONG,
        JSON.stringify(product),
      );

      return product;
    } catch (error) {
      throw error;
    }
  }

  async getProductById(id) {
    try {
      const product = await Product.findOne({ _id: id, deletedAt: null });
      return product;
    } catch (error) {
      throw error;
    }
  }

  async createProduct(data) {
    try {
      const product = new Product(data);
      await product.save();
      return product;
    } catch (error) {
      throw error;
    }
  }

  async updateProduct(id, data) {
    try {
      const existingProduct = await Product.findOne({ _id: id, deletedAt: null });
      if (!existingProduct) {
        return null;
      }

      const product = await Product.findOneAndUpdate(
        { _id: id, deletedAt: null },
        {
          ...data,
          updatedAt: new Date(),
        },
        { new: true },
      );

      if (!product) {
        return null;
      }

      // Invalidate cache
      const currentSlugCacheKey = `${CACHE_KEYS.PRODUCT}${product.slug}`;
      const previousSlugCacheKey = `${CACHE_KEYS.PRODUCT}${existingProduct.slug}`;
      await redisClient.del([currentSlugCacheKey, previousSlugCacheKey]);

      return product;
    } catch (error) {
      throw error;
    }
  }

  async deleteProduct(id) {
    try {
      const product = await Product.findOneAndUpdate(
        { _id: id, deletedAt: null },
        {
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
        { new: true },
      );

      if (!product) {
        return null;
      }

      const cacheKey = `${CACHE_KEYS.PRODUCT}${product.slug}`;
      await redisClient.del(cacheKey);

      return product;
    } catch (error) {
      throw error;
    }
  }

  async searchProducts(query, filters = {}, options = {}) {
    try {
      const { page = 1, limit = 10 } = options;

      const searchQuery = {
        deletedAt: null,
        ...filters,
        $or: [
          { name: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
          { sku: { $regex: query, $options: "i" } },
          { slug: { $regex: query, $options: "i" } },
          { brand: { $regex: query, $options: "i" } },
          { "variants.sku": { $regex: query, $options: "i" } },
        ],
      };

      const products = await Product.paginate(searchQuery, { page, limit });
      return products;
    } catch (error) {
      throw error;
    }
  }

  async getRelatedProducts(productId, limit = 6) {
    try {
      const product = await Product.findOne({
        _id: productId,
        deletedAt: null,
      });
      if (!product) return [];

      const relatedProducts = await Product.find({
        _id: { $ne: productId },
        status: "active",
        deletedAt: null,
        tags: { $in: product.tags },
      }).limit(limit);

      return relatedProducts;
    } catch (error) {
      throw error;
    }
  }

  async updateInventorySummary(productId) {
    try {
      const product = await Product.findOne({
        _id: productId,
        deletedAt: null,
      });
      // Update inventory summary logic here
      return product;
    } catch (error) {
      throw error;
    }
  }
}

export default new ProductService();
