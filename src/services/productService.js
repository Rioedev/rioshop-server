import Product from "../models/Product.js";
import Inventory from "../models/Inventory.js";
import { CACHE_KEYS, CACHE_TTL } from "../constants/index.js";
import { redisClient } from "../config/redis.js";
import { AppError } from "../utils/helpers.js";
import { SINGLE_WAREHOUSE_ID, SINGLE_WAREHOUSE_NAME } from "../constants/warehouse.js";
import {
  buildProductSku,
  buildVariantSku,
  normalizeSkuInput,
} from "../utils/productSku.js";

const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

  resolvePricingPayload(pricing, existingProduct = null) {
    const existingPricing = existingProduct?.pricing || {};
    const basePriceInput =
      pricing?.basePrice !== undefined
        ? Number(pricing.basePrice)
        : Number(existingPricing.basePrice);
    const salePriceInput =
      pricing?.salePrice !== undefined
        ? Number(pricing.salePrice)
        : Number(existingPricing.salePrice);

    if (!Number.isFinite(basePriceInput) || !Number.isFinite(salePriceInput)) {
      throw new AppError("Product pricing is invalid", 400);
    }

    const basePrice = Math.max(0, basePriceInput);
    const salePrice = Math.max(0, salePriceInput);
    if (salePrice > basePrice) {
      throw new AppError("Sale price must be less than or equal to base price", 400);
    }

    const currency =
      pricing?.currency?.toString().trim() ||
      existingPricing?.currency?.toString().trim() ||
      "VND";

    return {
      basePrice,
      salePrice,
      currency,
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

    if (data.collections !== undefined) {
      const uniqueCollections = new Map();
      for (const item of data.collections ?? []) {
        const id = item?._id?.toString().trim();
        const name = item?.name?.toString().trim();

        if (!id || !name || uniqueCollections.has(id)) {
          continue;
        }

        uniqueCollections.set(id, {
          _id: id,
          name,
          slug: item?.slug?.toString().trim() || "",
          image: item?.image?.toString().trim() || "",
        });
      }

      nextData.collections = Array.from(uniqueCollections.values());
    }

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

    if (!existingProduct || data.pricing !== undefined) {
      nextData.pricing = this.resolvePricingPayload(data.pricing, existingProduct);
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
      await this.syncSingleWarehouseInventoryForProduct(product);
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

      await this.syncSingleWarehouseInventoryForProduct(product);

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
      const regexQuery =
        query instanceof RegExp
          ? query
          : new RegExp(escapeRegex(String(query ?? "").trim()), "i");

      const searchQuery = {
        deletedAt: null,
        ...filters,
        $or: [
          { name: regexQuery },
          { sku: regexQuery },
          { slug: regexQuery },
          { brand: regexQuery },
          { "variants.sku": regexQuery },
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

  async syncSingleWarehouseInventoryForProduct(product) {
    if (!product?._id) {
      return;
    }

    const variants = Array.isArray(product.variants) ? product.variants : [];
    const variantSkus = variants
      .map((variant) => variant?.sku?.toString().trim())
      .filter(Boolean);

    const existingRows = await Inventory.find({
      productId: product._id,
      warehouseId: SINGLE_WAREHOUSE_ID,
    });
    const existingBySku = new Map(
      existingRows.map((row) => [row.variantSku?.toString().trim(), row]),
    );

    for (const variant of variants) {
      const variantSku = (variant?.sku || "").toString().trim();
      if (!variantSku) {
        continue;
      }

      const currentRow = existingBySku.get(variantSku);
      const reserved = Math.max(0, Number(currentRow?.reserved || 0));
      const available = Math.max(0, Number(variant?.stock || 0));
      const onHand = available + reserved;
      const incoming = Math.max(0, Number(currentRow?.incoming || 0));
      const reorderPoint =
        currentRow?.reorderPoint === undefined ? null : currentRow.reorderPoint;
      const reorderQty =
        currentRow?.reorderQty === undefined ? null : currentRow.reorderQty;
      const lowStockAlert =
        reorderPoint !== null && reorderPoint !== undefined
          ? available <= Number(reorderPoint || 0)
          : Boolean(currentRow?.lowStockAlert);

      await Inventory.findOneAndUpdate(
        {
          productId: product._id,
          variantSku,
          warehouseId: SINGLE_WAREHOUSE_ID,
        },
        {
          productId: product._id,
          variantSku,
          warehouseId: SINGLE_WAREHOUSE_ID,
          warehouseName: SINGLE_WAREHOUSE_NAME,
          onHand,
          reserved,
          available,
          incoming,
          reorderPoint,
          reorderQty,
          lowStockAlert,
          lastCountAt: currentRow?.lastCountAt || null,
          updatedAt: new Date(),
        },
        { upsert: true, new: true },
      );
    }

    if (variantSkus.length === 0) {
      await Inventory.deleteMany({
        productId: product._id,
        warehouseId: SINGLE_WAREHOUSE_ID,
      });
      return;
    }

    await Inventory.deleteMany({
      productId: product._id,
      warehouseId: SINGLE_WAREHOUSE_ID,
      variantSku: { $nin: variantSkus },
    });
  }
}

export default new ProductService();
