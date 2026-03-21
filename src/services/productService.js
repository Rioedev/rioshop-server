import Product from "../models/Product.js";
import { CACHE_KEYS, CACHE_TTL } from "../constants/index.js";
import { redisClient } from "../config/redis.js";
import { AppError } from "../utils/helpers.js";
import {
  buildProductSku,
  buildVariantSku,
  normalizeSkuInput,
} from "../utils/productSku.js";

export class ProductService {
  buildInventorySummary(variants = [], reserved = 0) {
    const safeReserved = Math.max(0, Number(reserved || 0));
    const available = (variants || []).reduce(
      (sum, variant) => sum + Math.max(0, Number(variant?.stock || 0)),
      0,
    );

    return {
      available,
      reserved: safeReserved,
      total: available + safeReserved,
    };
  }

  async skuExists(sku, excludeProductId = null) {
    const query = {
      deletedAt: null,
      $or: [{ sku }, { "variants.sku": sku }],
    };

    if (excludeProductId) {
      query._id = { $ne: excludeProductId };
    }

    return Boolean(await Product.exists(query));
  }

  async resolveUniqueSku(baseSku, reservedSkus, excludeProductId = null) {
    const normalizedBaseSku = normalizeSkuInput(baseSku) || "SKU";
    let candidate = normalizedBaseSku;
    let counter = 2;

    while (reservedSkus.has(candidate) || (await this.skuExists(candidate, excludeProductId))) {
      candidate = `${normalizedBaseSku}-${counter}`;
      counter += 1;
    }

    reservedSkus.add(candidate);
    return candidate;
  }

  async prepareProductPayload(data, existingProduct = null) {
    const nextData = { ...data };
    delete nextData.inventorySummary;
    const excludeProductId = existingProduct?._id?.toString() ?? null;
    const preservedVariantSkus =
      existingProduct && data.variants === undefined
        ? (existingProduct.variants ?? [])
            .map((variant) => normalizeSkuInput(variant.sku))
            .filter(Boolean)
        : [];

    if (!existingProduct || data.sku !== undefined) {
      const requestedProductSku =
        normalizeSkuInput(data.sku) ||
        buildProductSku({
          name: data.name ?? existingProduct?.name,
          categoryName: data.category?.name ?? existingProduct?.category?.name,
        });

      nextData.sku = await this.resolveUniqueSku(
        requestedProductSku,
        new Set(preservedVariantSkus),
        excludeProductId,
      );
    }

    if (data.variants !== undefined) {
      const productSkuForVariants = nextData.sku ?? existingProduct?.sku;

      if (!productSkuForVariants) {
        throw new AppError("Product SKU could not be generated", 400);
      }

      const reservedSkus = new Set([normalizeSkuInput(productSkuForVariants)]);
      nextData.variants = await Promise.all(
        (data.variants ?? []).map(async (variant, index) => {
          const nextSize = variant.size?.trim();
          if (!nextSize) {
            throw new AppError(`Variant #${index + 1} size is required`, 400);
          }

          const requestedVariantSku =
            normalizeSkuInput(variant.sku) ||
            buildVariantSku({
              productSku: productSkuForVariants,
              colorName: variant.color?.name,
              size: nextSize,
              index,
            });

          return {
            ...variant,
            variantId: variant.variantId?.trim(),
            sku: await this.resolveUniqueSku(requestedVariantSku, reservedSkus, excludeProductId),
            size: nextSize,
            sizeLabel: variant.sizeLabel?.trim() || nextSize,
            stock: Math.max(Number(variant.stock ?? 0), 0),
            barcode: variant.barcode?.trim() || "",
            images: (variant.images ?? []).map((image) => image?.trim()).filter(Boolean),
            color:
              variant.color && (variant.color.name || variant.color.hex || variant.color.imageUrl)
                ? {
                    name: variant.color.name?.trim() || "",
                    hex: variant.color.hex?.trim() || "",
                    imageUrl: variant.color.imageUrl?.trim() || "",
                  }
                : undefined,
          };
        }),
      );

      const reservedFromExisting = Number(existingProduct?.inventorySummary?.reserved || 0);
      nextData.inventorySummary = this.buildInventorySummary(nextData.variants, reservedFromExisting);

      const effectiveStatus = nextData.status ?? existingProduct?.status;
      if (effectiveStatus === "active" && nextData.inventorySummary.available <= 0) {
        nextData.status = "out_of_stock";
      } else if (
        effectiveStatus === "out_of_stock" &&
        nextData.inventorySummary.available > 0 &&
        data.status === undefined
      ) {
        nextData.status = "active";
      }
    }

    return nextData;
  }

  handleWriteError(error) {
    if (error?.code === 11000) {
      throw new AppError("SKU already exists", 409);
    }

    throw error;
  }

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
      const payload = await this.prepareProductPayload(data);
      const product = new Product(payload);
      await product.save();
      return product;
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async updateProduct(id, data) {
    try {
      const existingProduct = await Product.findOne({ _id: id, deletedAt: null });
      if (!existingProduct) {
        return null;
      }

      const payload = await this.prepareProductPayload(data, existingProduct);

      const product = await Product.findOneAndUpdate(
        { _id: id, deletedAt: null },
        {
          ...payload,
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
      this.handleWriteError(error);
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
