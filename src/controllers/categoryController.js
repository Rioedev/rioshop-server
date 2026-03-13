import {
  asyncHandler,
  sendSuccess,
  sendError,
  getPaginationParams,
} from "../utils/helpers.js";
import categoryService from "../services/categoryService.js";
import Category from "../models/Category.js";
import slugify from "slugify";
import { uploadToCloudinary } from "../utils/cloudinary.js";

/**
 * GET /api/categories
 * Get all categories with pagination and filtering
 */
export const getAllCategories = asyncHandler(async (req, res) => {
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);
  const { parentId, level, isActive } = req.query;

  const filters = {};
  if (parentId) filters.parentId = parentId;
  if (level !== undefined) filters.level = parseInt(level);
  if (isActive !== undefined) filters.isActive = isActive === "true";

  const categories = await categoryService.getAllCategories(filters, {
    page,
    limit,
  });

  sendSuccess(res, 200, categories, "Categories retrieved successfully");
});

/**
 * GET /api/categories/tree
 * Get all categories in tree structure
 */
export const getCategoryTree = asyncHandler(async (req, res) => {
  const tree = await categoryService.getCategoryTree();

  sendSuccess(res, 200, tree, "Category tree retrieved successfully");
});

/**
 * GET /api/categories/:slug
 * Get category by slug
 */
export const getCategoryBySlug = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryBySlug(req.params.slug);

  if (!category) {
    return sendError(res, 404, "Category not found");
  }

  // Get subcategories
  const subcategories = await categoryService.getSubcategories(category._id);

  const response = {
    ...category.toObject(),
    subcategories,
  };

  sendSuccess(res, 200, response, "Category retrieved successfully");
});

/**
 * GET /api/categories/id/:id
 * Get category by ID
 */
export const getCategoryById = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.id);

  if (!category) {
    return sendError(res, 404, "Category not found");
  }

  // Get subcategories
  const subcategories = await categoryService.getSubcategories(category._id);

  const response = {
    ...category.toObject(),
    subcategories,
  };

  sendSuccess(res, 200, response, "Category retrieved successfully");
});

/**
 * POST /api/categories
 * Create new category (Admin only)
 */
export const createCategory = asyncHandler(async (req, res) => {
  const { name, description, parentId, image, icon, position, seoMeta } =
    req.body;

  // Check if category with same name exists
  const existing = await Category.findOne({
    slug: slugify(name, { lower: true }),
    deletedAt: null,
  });
  if (existing) {
    return sendError(res, 409, "Category with this name already exists");
  }

  const categoryData = {
    name: name.trim(),
    slug: slugify(name, { lower: true }),
    description: description?.trim() || "",
    parentId,
    image,
    icon,
    position: position || 0,
    seoMeta,
    isActive: true,
  };

  const category = await categoryService.createCategory(categoryData);

  sendSuccess(res, 201, category, "Category created successfully");
});

/**
 * PUT /api/categories/:id
 * Update category (Admin only)
 */
export const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    parentId,
    image,
    icon,
    position,
    isActive,
    seoMeta,
  } = req.body;

  // Check if category exists
  const category = await categoryService.getCategoryById(id);
  if (!category) {
    return sendError(res, 404, "Category not found");
  }

  // If name changed, check for duplicates
  if (name && name !== category.name) {
    const newSlug = slugify(name, { lower: true });
    const existing = await Category.findOne({
      slug: newSlug,
      _id: { $ne: id },
      deletedAt: null,
    });
    if (existing) {
      return sendError(res, 409, "Category with this name already exists");
    }
  }

  const updateData = {};
  if (name) {
    updateData.name = name.trim();
    updateData.slug = slugify(name, { lower: true });
  }
  if (description !== undefined)
    updateData.description = description?.trim() || "";
  if (parentId !== undefined) updateData.parentId = parentId || null;
  if (image !== undefined) updateData.image = image;
  if (icon !== undefined) updateData.icon = icon;
  if (position !== undefined) updateData.position = position;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (seoMeta) updateData.seoMeta = seoMeta;

  updateData.updatedAt = new Date();

  const updatedCategory = await categoryService.updateCategory(id, updateData);

  sendSuccess(res, 200, updatedCategory, "Category updated successfully");
});

/**
 * DELETE /api/categories/:id
 * Delete category (Admin only)
 */
export const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if category exists
  const category = await categoryService.getCategoryById(id);
  if (!category) {
    return sendError(res, 404, "Category not found");
  }

  // Check if category has subcategories
  const hasChildren = await Category.countDocuments({
    parentId: id,
    deletedAt: null,
  });
  if (hasChildren > 0) {
    return sendError(
      res,
      400,
      "Cannot delete category that has subcategories. Please delete subcategories first.",
    );
  }

  const deletedCategory = await categoryService.deleteCategory(id);

  sendSuccess(res, 200, deletedCategory, "Category deleted successfully");
});

/**
 * GET /api/categories/:id/subcategories
 * Get subcategories of a category
 */
export const getSubcategories = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit } = getPaginationParams(req.query.page, req.query.limit);

  // Check if parent category exists
  const parentCategory = await categoryService.getCategoryById(id);
  if (!parentCategory) {
    return sendError(res, 404, "Category not found");
  }

  const subcategories = await categoryService.getSubcategories(id, limit);

  sendSuccess(res, 200, subcategories, "Subcategories retrieved successfully");
});

/**
 * GET /api/categories/search
 * Search categories
 */
export const searchCategories = asyncHandler(async (req, res) => {
  const { q, page, limit, isActive } = req.query;
  const { page: pageNum, limit: limitNum } = getPaginationParams(page, limit);
  const filters = {};
  if (isActive !== undefined) filters.isActive = isActive === "true";

  const results = await categoryService.searchCategories(
    q,
    filters,
    {
      page: pageNum,
      limit: limitNum,
    },
  );

  sendSuccess(res, 200, results, "Categories searched successfully");
});

/**
 * GET /api/categories/stats
 * Get category statistics
 */
export const getCategoryStats = asyncHandler(async (req, res) => {
  const stats = await categoryService.getCategoryStats();

  sendSuccess(res, 200, stats, "Category statistics retrieved successfully");
});

/**
 * POST /api/categories/upload-image
 * Upload category image
 */
export const uploadCategoryImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 400, "File image is required");
  }

  if (!req.file.mimetype?.startsWith("image/")) {
    return sendError(res, 400, "Only image files are allowed");
  }

  const base64 = req.file.buffer.toString("base64");
  const dataUri = `data:${req.file.mimetype};base64,${base64}`;
  const uploadResult = await uploadToCloudinary(dataUri, "rioshop/categories");

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
