import Product from "../models/product.model.js";
import mongoose from "mongoose";
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
 * Product Service
 * Handles all product-related business logic
 */
class ProductService {
  /**
   * Create new product
   */
  async createProduct(data, files = []) {
    const payload = { ...data };

    // Auto-generate slug from name
    if (!payload.slug || payload.slug === "") {
      payload.slug = slugify(payload.name, { lower: true });
    }

    // Remap temporary frontend color IDs to real ObjectIds
    if (payload.options?.colors?.length > 0) {
      const colorIdMap = {};

      payload.options.colors.forEach((color) => {
        if (color._id && color._id.startsWith("temp_")) {
          const newId = new mongoose.Types.ObjectId();
          colorIdMap[color._id] = newId.toString();
          color._id = newId;
        }
      });

      // Update variants to use the new mapped ObjectIds
      if (payload.variants?.length > 0) {
        payload.variants.forEach((variant) => {
          if (variant.colorId && colorIdMap[variant.colorId]) {
            variant.colorId = colorIdMap[variant.colorId];
          }
        });
      }
    }

    // Upload images for each color
    if (payload.options?.colors?.length > 0) {
      await this._processColorImages(payload.options.colors, files);
    }

    const product = await Product.create(payload);
    return product;
  }

  /**
   * Update product
   */
  async updateProduct(id, data, files = []) {
    const product = await Product.findOne({ _id: id, isDeleted: false });

    if (!product) {
      throwError(HTTP_STATUS.NOT_FOUND, ERROR_MESSAGES.PRODUCT_NOT_FOUND);
    }

    const updateData = { ...data };

    // Auto-generate slug if name changed
    if (updateData.name && updateData.name !== product.name) {
      updateData.slug = slugify(updateData.name, { lower: true });
    }

    // Handle color images update
    if (updateData.options?.colors) {
      await this._handleColorImagesUpdate(
        product,
        updateData.options.colors,
        files,
      );
    }

    Object.assign(product, updateData);
    await product.save();

    return product;
  }

  /**
   * Get all products with pagination
   */
  async getProducts(query = {}) {
    const { page = 1, limit = 10, keyword, status } = query;

    const filter = { isDeleted: false };

    if (status) filter.status = status;

    if (keyword) {
      filter.$or = [
        { name: { $regex: keyword, $options: "i" } },
        { slug: { $regex: keyword, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(
      Number(limit) || PAGINATION_CONFIG.DEFAULT_LIMIT,
      PAGINATION_CONFIG.MAX_LIMIT,
    );
    const skip = (pageNum - 1) * limitNum;

    const products = await Product.find(filter)
      .populate("categoryIds", "_id name")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments(filter);

    // Transform products to include thumbnail and min price
    const transformedProducts = products.map((product) => {
      const doc = product.toObject();
      let image = null;

      if (doc.options?.colors?.[0]?.images?.[0]) {
        const thumbnail = doc.options.colors[0].images.find(
          (img) => img.isThumbnail,
        );
        image = thumbnail?.url || doc.options.colors[0].images[0]?.url;
      }

      return {
        ...doc,
        image,
        price: doc.statistics?.minPrice || 0,
      };
    });

    return {
      data: transformedProducts,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  /**
   * Get product by ID
   */
  async getProductById(id) {
    const product = await Product.findOne({
      _id: id,
      isDeleted: false,
    }).populate("categoryIds", "_id name");

    if (!product) {
      throwError(HTTP_STATUS.NOT_FOUND, ERROR_MESSAGES.PRODUCT_NOT_FOUND);
    }

    return product;
  }

  /**
   * Soft delete product (mark as archived)
   */
  async softDeleteProduct(id) {
    const product = await Product.findByIdAndUpdate(
      id,
      { isDeleted: true, status: "archived" },
      { new: true },
    );

    if (!product) {
      throwError(HTTP_STATUS.NOT_FOUND, ERROR_MESSAGES.PRODUCT_NOT_FOUND);
    }

    return product;
  }

  /**
   * Restore soft deleted product
   */
  async restoreProduct(id) {
    const product = await Product.findByIdAndUpdate(
      id,
      { isDeleted: false, status: "draft" },
      { new: true },
    );

    if (!product) {
      throwError(HTTP_STATUS.NOT_FOUND, ERROR_MESSAGES.PRODUCT_NOT_FOUND);
    }

    return product;
  }

  /**
   * Hard delete product (permanently remove with all images)
   */
  async hardDeleteProduct(id) {
    const product = await Product.findById(id);

    if (!product) {
      throwError(HTTP_STATUS.NOT_FOUND, ERROR_MESSAGES.PRODUCT_NOT_FOUND);
    }

    // Delete all Cloudinary images
    await this._deleteProductImages(product);

    await product.deleteOne();

    return { message: "Product permanently deleted" };
  }

  /**
   * Process and upload images for colors
   * @private
   */
  async _processColorImages(colors, files = []) {
    let fileIndex = 0;

    for (let i = 0; i < colors.length; i++) {
      let color = colors[i];
      if (!color.images || !Array.isArray(color.images)) continue;

      const uploadedImages = [];

      for (let j = 0; j < color.images.length; j++) {
        let img = color.images[j];
        if (typeof img === "string" && files[fileIndex]) {
          // Upload new file
          const file = files[fileIndex++];
          const result = await cloudinary.uploader.upload(file.path, {
            folder: CLOUDINARY_CONFIG.PRODUCT_FOLDER,
          });

          uploadedImages.push({
            url: result.secure_url,
            public_id: result.public_id,
            isThumbnail: j === 0, // auto set first as thumbnail
          });
        } else if (typeof img === "object" && img.url && img.public_id) {
          // Already has URL and public_id
          uploadedImages.push(img);
        }
      }

      // Explicitly mutate the payload color images array so Product.create() gets objects, not strings.
      if (uploadedImages.length > 0) {
        colors[i].images = uploadedImages;
      } else {
        colors[i].images = []; // Prevents passing raw strings if upload failed
      }
    }
  }

  /**
   * Handle color images during update
   * @private
   */
  async _handleColorImagesUpdate(product, newColors, files = []) {
    // Find removed colors to delete their images
    const oldColorIds =
      product.options?.colors?.map((c) => c._id?.toString()) || [];
    const newColorIds = newColors
      .filter((c) => c._id)
      .map((c) => c._id?.toString());

    const removedColors = oldColorIds.filter((id) => !newColorIds.includes(id));

    // Delete images from removed colors
    for (let color of product.options?.colors || []) {
      if (removedColors.includes(color._id?.toString())) {
        await this._deleteColorImages(color.images || []);
      }
    }

    // Upload new images from files
    let fileIndex = 0;

    for (let color of newColors) {
      if (!color.images || !Array.isArray(color.images)) continue;

      const processedImages = [];

      for (let img of color.images) {
        if (typeof img === "object" && img.public_id) {
          // Already uploaded, keep it
          processedImages.push(img);
        } else if (typeof img === "string" && files[fileIndex]) {
          // Upload new file
          const file = files[fileIndex++];
          const result = await cloudinary.uploader.upload(file.path, {
            folder: CLOUDINARY_CONFIG.PRODUCT_FOLDER,
          });

          processedImages.push({
            url: result.secure_url,
            public_id: result.public_id,
            isThumbnail: img.isThumbnail || false,
          });
        } else if (typeof img === "object") {
          // Might be a new image object
          processedImages.push(img);
        }
      }

      color.images =
        processedImages.length > 0 ? processedImages : color.images;
    }
  }

  /**
   * Delete all images for a product
   * @private
   */
  async _deleteProductImages(product) {
    for (let color of product.options?.colors || []) {
      await this._deleteColorImages(color.images || []);
    }
  }

  /**
   * Delete images from color
   * @private
   */
  async _deleteColorImages(images = []) {
    for (let img of images) {
      try {
        if (img.public_id) {
          await cloudinary.uploader.destroy(img.public_id);
        }
      } catch (err) {
        console.error("Failed to delete Cloudinary image:", err);
        // Continue with other images even if one fails
      }
    }
  }
}

export default new ProductService();
