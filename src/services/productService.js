import Product from "../models/Product.js";
import { CACHE_KEYS, CACHE_TTL } from "../constants/index.js";
import { redisClient } from "../config/redis.js";

export class ProductService {
  async getAllProducts(filters = {}, options = {}) {
    const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;

    try {
      const query = Product.paginate(
        { status: "active", ...filters },
        {
          page,
          limit,
          sort,
          select: "-description",
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
      const product = await Product.findOne({ slug, status: "active" });

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
      const product = await Product.findById(id);
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
      const product = await Product.findByIdAndUpdate(id, data, { new: true });

      // Invalidate cache
      const cacheKey = `${CACHE_KEYS.PRODUCT}${product.slug}`;
      await redisClient.del(cacheKey);

      return product;
    } catch (error) {
      throw error;
    }
  }

  async deleteProduct(id) {
    try {
      const product = await Product.findByIdAndDelete(id);
      return product;
    } catch (error) {
      throw error;
    }
  }

  async searchProducts(query, filters = {}, options = {}) {
    try {
      const { page = 1, limit = 10 } = options;

      const searchQuery = {
        $text: { $search: query },
        status: "active",
        ...filters,
      };

      const products = await Product.paginate(searchQuery, { page, limit });
      return products;
    } catch (error) {
      throw error;
    }
  }

  async getRelatedProducts(productId, limit = 6) {
    try {
      const product = await Product.findById(productId);
      if (!product) return [];

      const relatedProducts = await Product.find({
        _id: { $ne: productId },
        status: "active",
        tags: { $in: product.tags },
      }).limit(limit);

      return relatedProducts;
    } catch (error) {
      throw error;
    }
  }

  async updateInventorySummary(productId) {
    try {
      const product = await Product.findById(productId);
      // Update inventory summary logic here
      return product;
    } catch (error) {
      throw error;
    }
  }
}

export default new ProductService();
