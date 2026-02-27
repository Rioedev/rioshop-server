import Category from "../models/category.model.js";
import slugify from "slugify";
import cloudinary from "../config/cloudinary.js";
import { uploadToCloudinary } from "../utils/cloudinaryUpload.js";
import { CLOUDINARY_FOLDERS } from "../constants/cloudinaryFolders.js";

export const createCategory = async (req, res) => {
  try {
    const payload = req.body;
    payload.slug = slugify(payload.name, { lower: true });

    // upload image nếu có
     if (req.file) {
      payload.image = await uploadToCloudinary(
        req.file.path,
        CLOUDINARY_FOLDERS.CATEGORY
      );
    }

    const category = await Category.create(payload);

    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCategories = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const query = { isDeleted: false };

    if (status) {
      query.status = status;
    }

    const options = {
      page: Number(page),
      limit: Number(limit),
      sort: { sortOrder: 1 },
      lean: true,
    };

    const result = await Category.paginate(query, options);

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCategoryTree = async (req, res) => {
  try {
    const categories = await Category.find({
      isDeleted: false,
      status: "active",
    });

    const buildTree = (parentId = null) => {
      return categories
        .filter((cat) => String(cat.parentId) === String(parentId))
        .map((cat) => ({
          ...cat._doc,
          children: buildTree(cat._id),
        }));
    };

    const tree = buildTree(null);

    res.json(tree);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findOne({
      _id: id,
      isDeleted: false,
    }).populate("parentId", "name slug");

    if (!category) {
      return res.status(404).json({
        message: "Danh mục không tồn tại",
      });
    }

    res.json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({ message: "Danh mục không tồn tại" });
    }

    if (payload.name) {
      payload.slug = slugify(payload.name, { lower: true });
    }

    // nếu có ảnh mới
    if (req.file) {
      // xoá ảnh cũ trên Cloudinary
      if (category.image?.public_id) {
        await cloudinary.uploader.destroy(category.image.public_id);
      }
      payload.image = await uploadToCloudinary(
        req.file.path,
        CLOUDINARY_FOLDERS.CATEGORY
      );
    }

    const updated = await Category.findByIdAndUpdate(id, payload, {
      new: true,
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const softDeleteCategory = async (req, res) => {
  try {
    await Category.findByIdAndUpdate(req.params.id, {
      isDeleted: true,
      status: "inactive",
    });

    res.json({ message: "Đã xoá danh mục" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const hardDeleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Danh mục không tồn tại" });
    }

    if (category.image?.public_id) {
      await cloudinary.uploader.destroy(category.image.public_id);
    }

    await category.deleteOne();

    res.json({ message: "Đã xoá vĩnh viễn" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
