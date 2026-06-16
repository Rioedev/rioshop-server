import Product from "../models/Product.js";
import Order from "../models/Order.js";
import mongoose from "mongoose";
import Inventory from "../models/Inventory.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
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

const normalizeRecommendationText = (value = "") =>
  value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase();

const classifyProductCategory = (product) => {
  const value = normalizeRecommendationText(
    [product?.category?.name, product?.category?.slug, ...(product?.tags || [])].join(" "),
  );

  if (/\b(ao khoac|jacket|blazer|cardigan|hoodie)\b/.test(value)) return "outerwear";
  if (/\b(quan|pants|jeans|short)\b/.test(value)) return "bottom";
  if (/\b(vay|dam|dress|skirt)\b/.test(value)) return "dress";
  if (/\b(giay|dep|sandal|shoe|sneaker)\b/.test(value)) return "footwear";
  if (/\b(mu|non|tui|that lung|phu kien|accessor)\b/.test(value)) return "accessory";
  if (/\b(ao|shirt|polo|top|blouse|tank)\b/.test(value)) return "top";
  return "other";
};

const COMPLEMENTARY_CATEGORY_GROUPS = {
  top: new Set(["bottom", "outerwear", "accessory"]),
  bottom: new Set(["top", "outerwear", "accessory"]),
  dress: new Set(["outerwear", "accessory", "footwear"]),
  outerwear: new Set(["top", "bottom", "dress"]),
  accessory: new Set(["top", "bottom", "dress", "outerwear"]),
  footwear: new Set(["bottom", "dress"]),
};

const toStringSet = (values = []) =>
  new Set(values.map((value) => value?.toString?.().trim()).filter(Boolean));

const pickLegacyAwarePrice = (canonical, legacy, fallback = NaN) => {
  const canonicalNumber = Number(canonical);
  const legacyNumber = Number(legacy);

  if (Number.isFinite(canonicalNumber) && canonicalNumber > 0) {
    return canonicalNumber;
  }
  if (Number.isFinite(legacyNumber) && legacyNumber > 0) {
    return legacyNumber;
  }
  if (Number.isFinite(canonicalNumber)) {
    return canonicalNumber;
  }
  if (Number.isFinite(legacyNumber)) {
    return legacyNumber;
  }
  return fallback;
};

const normalizeProductPricingForRead = (product) => {
  if (!product) return product;
  const pricing = product.pricing || {};
  const regularPrice = Math.max(
    0,
    pickLegacyAwarePrice(pricing.regularPrice, pricing.salePrice, 0),
  );
  const compareAtPrice = Math.max(
    0,
    pickLegacyAwarePrice(pricing.compareAtPrice, pricing.basePrice, 0),
  );

  return {
    ...product,
    pricing: {
      ...pricing,
      regularPrice,
      compareAtPrice,
      salePrice: regularPrice,
      basePrice: compareAtPrice,
    },
  };
};

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
    const existingRegularPrice = pickLegacyAwarePrice(
      existingPricing?.regularPrice,
      existingPricing?.salePrice,
    );
    const existingCompareAtPrice = pickLegacyAwarePrice(
      existingPricing?.compareAtPrice,
      existingPricing?.basePrice,
      0,
    );
    const regularPriceInput =
      pricing?.regularPrice !== undefined
        ? Number(pricing.regularPrice)
        : pricing?.salePrice !== undefined
          ? Number(pricing.salePrice)
          : existingRegularPrice;
    const compareAtPriceInput =
      pricing?.compareAtPrice !== undefined
        ? Number(pricing.compareAtPrice)
        : pricing?.basePrice !== undefined
          ? Number(pricing.basePrice)
          : existingCompareAtPrice;

    if (!Number.isFinite(regularPriceInput)) {
      throw new AppError("Regular price is required", 400);
    }

    const regularPrice = Math.max(0, regularPriceInput);
    // compareAtPrice là giá tham chiếu/MSRP/giá niêm yết để so sánh. Nếu không nhập
    // hoặc = 0 thì storefront không hiển thị giá gạch ngang.
    const compareAtPrice = Number.isFinite(compareAtPriceInput)
      ? Math.max(0, compareAtPriceInput)
      : 0;
    if (compareAtPrice > 0 && compareAtPrice < regularPrice) {
      throw new AppError("Compare-at price must be greater than or equal to regular price", 400);
    }

    const currency =
      pricing?.currency?.toString().trim() ||
      existingPricing?.currency?.toString().trim() ||
      "VND";

    // costPrice chỉ thay đổi qua PO nhập hàng (weighted avg) — admin gửi gì cũng giữ
    // theo DB. Sản phẩm mới chưa có PO nào thì = 0.
    const costPrice = Math.max(0, Number(existingPricing?.costPrice ?? 0));

    return {
      regularPrice,
      compareAtPrice,
      // Legacy aliases for old UI/data. Canonical names above are the source of truth.
      salePrice: regularPrice,
      basePrice: compareAtPrice,
      costPrice,
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

      // Map các variant đang có theo SKU để giữ nguyên stock / costPrice / incoming
      // — admin KHÔNG được phép sửa 3 field này qua form sản phẩm. Chúng chỉ thay đổi
      // qua PO nhập hàng hoặc Điều chỉnh kho (luồng có audit trail).
      const existingVariantMap = new Map(
        (existingProduct?.variants ?? []).map((variant) => [
          (variant.sku || "").trim(),
          variant,
        ]),
      );

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

          const resolvedSku = await this.resolveUniqueSku(
            requestedVariantSku,
            reservedSkus,
            excludeProductId,
          );

          // Variant mới (chưa từng tồn tại) → stock/cost/incoming = 0 (chờ PO).
          // Variant đã có → giữ nguyên các giá trị đang lưu trong DB.
          const matchedExisting = existingVariantMap.get(resolvedSku) ?? null;

          return {
            ...variant,
            variantId: variant.variantId?.trim(),
            sku: resolvedSku,
            size: nextSize,
            sizeLabel: variant.sizeLabel?.trim() || nextSize,
            stock: Math.max(0, Number(matchedExisting?.stock ?? 0)),
            incoming: Math.max(0, Number(matchedExisting?.incoming ?? 0)),
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

  async getBestSellingProducts(filters = {}, options = {}) {
    const { page = 1, limit = 10 } = options;
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));

    const [result] = await Order.aggregate([
      {
        $match: {
          status: { $in: ["delivered", "completed"] },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          salesCount: {
            $sum: {
              $max: [
                { $subtract: ["$items.quantity", { $ifNull: ["$items.returnedQty", 0] }] },
                0,
              ],
            },
          },
          orderIds: { $addToSet: "$_id" },
        },
      },
      {
        $lookup: {
          from: Product.collection.name,
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$product",
              {
                salesCount: "$salesCount",
                salesOrderCount: { $size: "$orderIds" },
              },
            ],
          },
        },
      },
      { $match: { deletedAt: null, ...filters } },
      { $sort: { salesCount: -1, createdAt: -1 } },
      {
        $facet: {
          docs: [{ $skip: (safePage - 1) * safeLimit }, { $limit: safeLimit }],
          metadata: [{ $count: "totalDocs" }],
        },
      },
    ]);

    const docs = (result?.docs ?? []).map(normalizeProductPricingForRead);
    const totalDocs = result?.metadata?.[0]?.totalDocs ?? 0;

    return {
      docs,
      totalDocs,
      limit: safeLimit,
      page: safePage,
      totalPages: Math.max(1, Math.ceil(totalDocs / safeLimit)),
      hasPrevPage: safePage > 1,
      hasNextPage: safePage * safeLimit < totalDocs,
    };
  }

  async getNewArrivalProducts(filters = {}, options = {}) {
    const { page = 1, limit = 10 } = options;
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));

    const [result] = await Product.aggregate([
      {
        $set: {
          effectivePublishedAt: { $ifNull: ["$publishedAt", "$createdAt"] },
        },
      },
      { $match: { deletedAt: null, ...filters } },
      { $sort: { effectivePublishedAt: -1, createdAt: -1 } },
      {
        $facet: {
          docs: [{ $skip: (safePage - 1) * safeLimit }, { $limit: safeLimit }],
          metadata: [{ $count: "totalDocs" }],
        },
      },
    ]);

    const docs = (result?.docs ?? []).map(normalizeProductPricingForRead);
    const totalDocs = result?.metadata?.[0]?.totalDocs ?? 0;

    return {
      docs,
      totalDocs,
      limit: safeLimit,
      page: safePage,
      totalPages: Math.max(1, Math.ceil(totalDocs / safeLimit)),
      hasPrevPage: safePage > 1,
      hasNextPage: safePage * safeLimit < totalDocs,
    };
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
      // Sản phẩm tạo mới luôn là "draft" — chưa có PO nhập hàng nên không thể
      // bán được. Admin muốn bán phải nhập hàng trước rồi update sang "active".
      payload.status = "draft";
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

      if (!existingProduct.publishedAt) {
        const isFirstActivation = existingProduct.status !== "active" && payload.status === "active";
        if (isFirstActivation) {
          payload.publishedAt = new Date();
        } else if (existingProduct.status === "active") {
          payload.publishedAt = existingProduct.createdAt || new Date();
        }
      }

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
      // Chặn xóa nếu sp đang có PO chưa kết thúc — tránh orphan PO không nhận được.
      // Phải hủy/nhận xong các PO liên quan trước rồi mới xóa.
      const activePo = await PurchaseOrder.findOne({
        "lines.productId": id,
        status: { $in: ["draft", "ordered", "partially_received"] },
      })
        .select("poNumber status")
        .lean();
      if (activePo) {
        throw new AppError(
          `Không thể xóa: sản phẩm đang có đơn nhập ${activePo.poNumber} (${activePo.status}). Hãy hủy hoặc hoàn tất đơn nhập trước.`,
          409,
        );
      }

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

  async getCartRecommendations(productIds = [], limit = 4) {
    const uniqueProductIds = [...new Set(productIds.map((id) => id?.toString().trim()).filter(Boolean))];
    const safeLimit = Math.max(1, Math.min(12, Number(limit) || 4));
    if (uniqueProductIds.length === 0) return [];

    const cartObjectIds = uniqueProductIds.map((id) => new mongoose.Types.ObjectId(id));
    const cartProducts = await Product.find({
      _id: { $in: cartObjectIds },
      deletedAt: null,
    }).lean();
    if (cartProducts.length === 0) return [];

    const cartGenders = new Set(
      cartProducts
        .map((product) => product.gender?.toString().trim())
        .filter((gender) => gender && gender !== "unisex"),
    );
    const allowedCandidateGenders =
      cartGenders.size > 0 ? [...cartGenders, "unisex"] : null;

    const coPurchaseRows = await Order.aggregate([
      {
        $match: {
          status: { $in: ["delivered", "completed"] },
          "exchangeMeta.isReplacement": { $ne: true },
          "items.productId": { $in: cartObjectIds },
          $or: [
            { paymentStatus: "paid" },
            {
              paymentMethod: "cod",
              status: { $in: ["delivered", "completed"] },
            },
          ],
        },
      },
      { $unwind: "$items" },
      { $match: { "items.productId": { $nin: cartObjectIds } } },
      {
        $group: {
          _id: "$items.productId",
          orderIds: { $addToSet: "$_id" },
          purchasedQuantity: {
            $sum: {
              $max: [
                { $subtract: ["$items.quantity", { $ifNull: ["$items.returnedQty", 0] }] },
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          orderCount: { $size: "$orderIds" },
          purchasedQuantity: 1,
        },
      },
      { $sort: { orderCount: -1, purchasedQuantity: -1 } },
      { $limit: 100 },
    ]);

    const coPurchaseByProductId = new Map(
      coPurchaseRows.map((row) => [row._id.toString(), row]),
    );
    const maxCoPurchaseOrders = Math.max(
      1,
      ...coPurchaseRows.map((row) => Number(row.orderCount || 0)),
    );

    const candidateFilter = {
      _id: { $nin: cartObjectIds },
      status: "active",
      deletedAt: null,
      ...(allowedCandidateGenders
        ? { gender: { $in: allowedCandidateGenders } }
        : {}),
      $or: [
        { "inventorySummary.available": { $gt: 0 } },
        { variants: { $elemMatch: { isActive: { $ne: false }, stock: { $gt: 0 } } } },
      ],
    };
    const coPurchaseProductIds = coPurchaseRows.map((row) => row._id);
    const [coPurchaseCandidates, fallbackCandidates] = await Promise.all([
      coPurchaseProductIds.length > 0
        ? Product.find({
            ...candidateFilter,
            _id: { $in: coPurchaseProductIds, $nin: cartObjectIds },
          }).lean()
        : [],
      Product.find(candidateFilter)
        .sort({ totalSold: -1, "ratings.avg": -1, createdAt: -1 })
        .limit(120)
        .lean(),
    ]);
    const candidateMap = new Map();
    [...coPurchaseCandidates, ...fallbackCandidates].forEach((product) => {
      candidateMap.set(product._id.toString(), product);
    });
    const candidates = Array.from(candidateMap.values());

    const maxTotalSold = Math.max(1, ...candidates.map((product) => Number(product.totalSold || 0)));

    return candidates
      .map((candidate) => {
        const candidateId = candidate._id.toString();
        const coPurchase = coPurchaseByProductId.get(candidateId);
        const coPurchaseScore = coPurchase
          ? (Number(coPurchase.orderCount || 0) / maxCoPurchaseOrders) * 55
          : 0;

        let relationScore = 0;
        const candidateCategoryGroup = classifyProductCategory(candidate);
        const candidateCollections = toStringSet(candidate.collections?.map((item) => item?._id));
        const candidateTags = new Set((candidate.tags || []).map(normalizeRecommendationText));

        cartProducts.forEach((cartProduct) => {
          let anchorScore = 0;
          const cartCategoryGroup = classifyProductCategory(cartProduct);
          const complementaryGroups = COMPLEMENTARY_CATEGORY_GROUPS[cartCategoryGroup] || new Set();

          if (complementaryGroups.has(candidateCategoryGroup)) {
            anchorScore += 14;
          } else if (
            candidate.category?._id &&
            candidate.category._id.toString() === cartProduct.category?._id?.toString()
          ) {
            anchorScore += 6;
          }

          if (candidate.gender && candidate.gender === cartProduct.gender) {
            anchorScore += 5;
          }

          const cartCollections = toStringSet(cartProduct.collections?.map((item) => item?._id));
          if ([...candidateCollections].some((id) => cartCollections.has(id))) {
            anchorScore += 4;
          }

          const cartTags = new Set((cartProduct.tags || []).map(normalizeRecommendationText));
          if ([...candidateTags].some((tag) => tag && cartTags.has(tag))) {
            anchorScore += 2;
          }

          if (anchorScore > relationScore) {
            relationScore = Math.min(25, anchorScore);
          }
        });

        const popularityScore = (Number(candidate.totalSold || 0) / maxTotalSold) * 10;
        const ratingScore = (Math.min(5, Math.max(0, Number(candidate.ratings?.avg || 0))) / 5) * 5;
        const score = Math.min(100, coPurchaseScore + relationScore + popularityScore + ratingScore);

        return {
          product: normalizeProductPricingForRead(candidate),
          score: Number(score.toFixed(1)),
          signals: {
            coPurchaseOrders: Number(coPurchase?.orderCount || 0),
            coPurchaseQuantity: Number(coPurchase?.purchasedQuantity || 0),
          },
        };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, safeLimit);
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
