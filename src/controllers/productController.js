import {
  asyncHandler,
  sendSuccess,
  sendError,
  getPaginationParams,
} from "../utils/helpers.js";
import productService from "../services/productService.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const parseCsvValues = (value) =>
  String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const VIETNAMESE_CHAR_GROUPS = {
  a: "a\u00e0\u00e1\u1ea1\u1ea3\u00e3\u0103\u1eb1\u1eaf\u1eb7\u1eb3\u1eb5\u00e2\u1ea7\u1ea5\u1ead\u1ea9\u1eab",
  e: "e\u00e8\u00e9\u1eb9\u1ebb\u1ebd\u00ea\u1ec1\u1ebf\u1ec7\u1ec3\u1ec5",
  i: "i\u00ec\u00ed\u1ecb\u1ec9\u0129",
  o: "o\u00f2\u00f3\u1ecd\u1ecf\u00f5\u00f4\u1ed3\u1ed1\u1ed9\u1ed5\u1ed7\u01a1\u1edd\u1edb\u1ee3\u1edf\u1ee1",
  u: "u\u00f9\u00fa\u1ee5\u1ee7\u0169\u01b0\u1eeb\u1ee9\u1ef1\u1eed\u1eef",
  y: "y\u1ef3\u00fd\u1ef5\u1ef7\u1ef9",
  d: "d\u0111",
};

const stripVietnameseDiacritics = (value = "") =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D");
const toVietnameseFlexibleRegex = (value = "") => {
  const normalized = stripVietnameseDiacritics(value).toLowerCase().trim();
  if (!normalized) {
    return null;
  }

  const pattern = normalized
    .split(/\s+/)
    .map((token) =>
      token
        .split("")
        .map((char) => {
          const group = VIETNAMESE_CHAR_GROUPS[char];
          return group ? `[${group}]` : escapeRegex(char);
        })
        .join(""),
    )
    .join("\\s+");

  return new RegExp(pattern, "i");
};

export const getAllProducts = asyncHandler(async (req, res) => {
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);
  const {
    q,
    category,
    collection,
    gender,
    minPrice,
    maxPrice,
    color,
    size,
    sort,
    status = "active",
  } = req.query;

  const filters = {};
  if (status && status !== "all") filters.status = status;
  if (category) filters["category._id"] = category;
  if (collection) filters["collections._id"] = collection;
  if (gender) filters.gender = gender;

  const keyword = String(q ?? "").trim();
  if (keyword) {
    const keywordRegex = toVietnameseFlexibleRegex(keyword);
    const keywordFilter = keywordRegex ?? {
      $regex: escapeRegex(keyword),
      $options: "i",
    };

    filters.$or = [
      { name: keywordFilter },
      { brand: keywordFilter },
      { sku: keywordFilter },
      { slug: keywordFilter },
      { "variants.sku": keywordFilter },
    ];
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    filters["pricing.salePrice"] = {};
    if (minPrice !== undefined) {
      filters["pricing.salePrice"].$gte = Number(minPrice);
    }
    if (maxPrice !== undefined) {
      filters["pricing.salePrice"].$lte = Number(maxPrice);
    }
  }

  const colorValues = parseCsvValues(color);
  const sizeValues = parseCsvValues(size);
  if (colorValues.length > 0 || sizeValues.length > 0) {
    const variantFilter = {
      isActive: { $ne: false },
    };

    if (sizeValues.length > 0) {
      variantFilter.size = {
        $in: sizeValues,
      };
    }

    if (colorValues.length > 0) {
      variantFilter.$or = colorValues.map((item) => {
        const escaped = escapeRegex(item);
        const isHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(item);
        return isHex
          ? { "color.hex": { $regex: `^${escaped}$`, $options: "i" } }
          : {
              $or: [
                { "color.name": { $regex: escaped, $options: "i" } },
                { "color.hex": { $regex: `^${escaped}$`, $options: "i" } },
              ],
            };
      });
    }

    filters.variants = { $elemMatch: variantFilter };
  }

  let parsedSort = { createdAt: -1 };
  if (sort) {
    try {
      parsedSort = JSON.parse(sort);
    } catch {
      return sendError(res, 400, "Invalid sort format");
    }
  }

  const products = await productService.getAllProducts(filters, {
    page,
    limit,
    sort: parsedSort,
  });

  sendSuccess(res, 200, products, "Products fetched successfully");
});

export const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await productService.getProductBySlug(req.params.slug);

  if (!product) {
    return sendError(res, 404, "Product not found");
  }

  // Increment view count asynchronously
  await productService.updateProduct(product._id, {
    viewCount: (product.viewCount || 0) + 1,
  });

  sendSuccess(res, 200, product, "Product fetched successfully");
});

export const searchProducts = asyncHandler(async (req, res) => {
  const { q, page, limit, status = "active" } = req.query;

  if (!q || q.trim().length === 0) {
    return sendError(res, 400, "Search query is required");
  }

  const { page: pageNum, limit: limitNum } = getPaginationParams(page, limit);
  const filters = {};
  if (status && status !== "all") filters.status = status;

  const keyword = q.trim();
  const keywordRegex = toVietnameseFlexibleRegex(keyword);
  const products = await productService.searchProducts(
    keywordRegex ?? keyword,
    filters,
    {
      page: pageNum,
      limit: limitNum,
    },
  );

  sendSuccess(res, 200, products, "Products searched successfully");
});

export const createProduct = asyncHandler(async (req, res) => {
  // Typically called by admin only
  const product = await productService.createProduct(req.body);
  sendSuccess(res, 201, product, "Product created successfully");
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.body);

  if (!product) {
    return sendError(res, 404, "Product not found");
  }

  sendSuccess(res, 200, product, "Product updated successfully");
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await productService.deleteProduct(req.params.id);

  if (!product) {
    return sendError(res, 404, "Product not found");
  }

  sendSuccess(res, 200, product, "Product deleted successfully");
});

export const uploadProductImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 400, "File image is required");
  }

  if (!req.file.mimetype?.startsWith("image/")) {
    return sendError(res, 400, "Only image files are allowed");
  }

  const base64 = req.file.buffer.toString("base64");
  const dataUri = `data:${req.file.mimetype};base64,${base64}`;
  const uploadResult = await uploadToCloudinary(dataUri, "rioshop/products");

  sendSuccess(
    res,
    200,
    {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    },
    "Image uploaded successfully",
  );
});

export const getRelatedProducts = asyncHandler(async (req, res) => {
  const relatedProducts = await productService.getRelatedProducts(
    req.params.id,
    6,
  );
  sendSuccess(res, 200, relatedProducts, "Related products fetched");
});

