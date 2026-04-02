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
    const keywordRegex = { $regex: escapeRegex(keyword), $options: "i" };
    filters.$or = [
      { name: keywordRegex },
      { brand: keywordRegex },
      { sku: keywordRegex },
      { shortDescription: keywordRegex },
      { description: keywordRegex },
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

  const products = await productService.searchProducts(
    q,
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
