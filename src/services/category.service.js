import Category from "../models/category.model.js";
import cloudinary from "../config/cloudinary.js";
import slugify from "slugify";
import { throwError } from "../utils/asyncHandler.js";
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  CLOUDINARY_CONFIG,
  PAGINATION_CONFIG,
} from "../config/constants.js";

/**
 * Category Service
 * Handles all category-related business logic
 */
class CategoryService {
  /**
   * Create new category
   */
  async createCategory(data, file) {
    const { name, description, parentId, sortOrder, status } = data;

    if (!file) {
      throwError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_MESSAGES.CATEGORY_IMAGE_REQUIRED,
      );
    }

    // Generate slug from name
    const slug = slugify(name, { lower: true });

    // Check if slug already exists
    const existingCategory = await Category.findOne({
      slug,
      isDeleted: false,
    });

    if (existingCategory) {
      throwError(HTTP_STATUS.CONFLICT, ERROR_MESSAGES.SLUG_EXISTS);
    }

    // Upload image to Cloudinary
    const imageData = await this._uploadImage(
      file,
      CLOUDINARY_CONFIG.CATEGORY_FOLDER,
    );

    // Create category
    const category = await Category.create({
      name,
      slug,
      description,
      image: imageData,
      parentId: parentId || null,
      sortOrder: sortOrder || 0,
      status: status || "active",
    });

    return category;
  }

  /**
   * Update category
   */
  async updateCategory(id, data, file) {
    const category = await Category.findById(id);

    if (!category || category.isDeleted) {
      throwError(HTTP_STATUS.NOT_FOUND, ERROR_MESSAGES.CATEGORY_NOT_FOUND);
    }

    const updateData = { ...data };

    // Update slug if name changed
    if (data.name) {
      const newSlug = slugify(data.name, { lower: true });

      if (newSlug !== category.slug) {
        const existingCategory = await Category.findOne({
          slug: newSlug,
          _id: { $ne: id },
          isDeleted: false,
        });

        if (existingCategory) {
          throwError(HTTP_STATUS.CONFLICT, ERROR_MESSAGES.SLUG_EXISTS);
        }

        updateData.slug = newSlug;
      }
    }

    // Handle image update
    if (file) {
      // Delete old image from Cloudinary
      if (category.image?.public_id) {
        await cloudinary.uploader.destroy(category.image.public_id);
      }

      // Upload new image
      const imageData = await this._uploadImage(
        file,
        CLOUDINARY_CONFIG.CATEGORY_FOLDER,
      );
      updateData.image = imageData;
    }

    const updated = await Category.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    return updated;
  }

  /**
   * Get all categories with pagination
   */
  async getCategories(query = {}) {
    const { page = 1, limit = 10, status, search } = query;

    const filter = { isDeleted: false };

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
      ];
    }

    const options = {
      page: Math.max(1, Number(page)),
      limit: Math.min(
        Number(limit) || PAGINATION_CONFIG.DEFAULT_LIMIT,
        PAGINATION_CONFIG.MAX_LIMIT,
      ),
      sort: { sortOrder: 1, createdAt: -1 },
      populate: {
        path: "parentId",
        select: "name slug",
      },
      lean: true,
    };

    return await Category.paginate(filter, options);
  }

  /**
   * Get category tree (hierarchical structure)
   */
  async getCategoryTree() {
    const categories = await Category.find({
      isDeleted: false,
      status: "active",
    }).lean();

    const buildTree = (parentId = null) => {
      return categories
        .filter((cat) =>
          parentId
            ? String(cat.parentId) === String(parentId)
            : cat.parentId === null,
        )
        .map((cat) => ({
          ...cat,
          children: buildTree(cat._id),
        }));
    };

    return buildTree();
  }

  /**
   * Get category by ID
   */
  async getCategoryById(id) {
    const category = await Category.findOne({
      _id: id,
      isDeleted: false,
    }).populate("parentId", "name slug");

    if (!category) {
      throwError(HTTP_STATUS.NOT_FOUND, ERROR_MESSAGES.CATEGORY_NOT_FOUND);
    }

    return category;
  }

  /**
   * Soft delete category (mark as deleted)
   */
  async softDeleteCategory(id) {
    // Check if category has children
    const hasChildren = await Category.findOne({
      parentId: id,
      isDeleted: false,
    });

    if (hasChildren) {
      throwError(
        HTTP_STATUS.BAD_REQUEST,
        "Cannot delete category with children",
      );
    }

    await Category.findByIdAndUpdate(id, {
      isDeleted: true,
      status: "inactive",
    });

    return { message: "Category soft deleted" };
  }

  /**
   * Hard delete category (permanently remove)
   */
  async hardDeleteCategory(id) {
    const category = await Category.findById(id);

    if (!category) {
      throwError(HTTP_STATUS.NOT_FOUND, ERROR_MESSAGES.CATEGORY_NOT_FOUND);
    }

    // Delete image from Cloudinary
    if (category.image?.public_id) {
      await cloudinary.uploader.destroy(category.image.public_id);
    }

    await Category.findByIdAndDelete(id);

    return { message: "Category deleted permanently" };
  }

  /**
   * Upload image to Cloudinary
   * @private
   */
  async _uploadImage(file, folder) {
    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    const result = await cloudinary.uploader.upload(dataUri, { folder });

    return {
      url: result.secure_url,
      public_id: result.public_id,
    };
  }
}

export default new CategoryService();
