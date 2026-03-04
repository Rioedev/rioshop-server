import Category from "../models/category.model.js";
import slugify from "slugify";
import cloudinary from "../config/cloudinary.js";
import { categorySchema } from "../validations/category.validation.js";

/* =========================
   CREATE
========================= */
export const createCategory = async (req, res) => {
  try {
    // validate body fields (excluding image)
    const { error } = categorySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: error.details[0].message,
      });
    }

    // image file must be present
    if (!req.file) {
      return res.status(400).json({ message: "Ảnh danh mục là bắt buộc" });
    }

    const payload = { ...req.body };
    payload.slug = slugify(payload.name, { lower: true });

    // check slug duplicate
    const existed = await Category.findOne({
      slug: payload.slug,
      isDeleted: false,
    });

    if (existed) {
      return res.status(400).json({
        message: "Slug đã tồn tại",
      });
    }

    // upload image buffer to Cloudinary
    const file = req.file;
    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "categories",
    });

    payload.image = {
      url: result.secure_url,
      public_id: result.public_id,
    };

    const category = await Category.create(payload);

    return res.status(201).json({
      message: "Thêm danh mục thành công",
      category,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

/* =========================
   GET ALL (PAGINATE)
========================= */
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
      sort: { sortOrder: 1, createdAt: -1 },
      populate: {
        path: "parentId",
        select: "name slug",
      },
      lean: true,
    };

    const result = await Category.paginate(query, options);

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================
   SEARCH (NEW API)
   GET /api/categories/search?q=ao&page=1&limit=10
========================= */
export const searchCategories = async (req, res) => {
  try {
    const { q = "", page = 1, limit = 10, status } = req.query;

    const query = {
      isDeleted: false,
      $or: [
        { name: { $regex: q, $options: "i" } },
        { slug: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ],
    };

    if (status) {
      query.status = status;
    }

    const options = {
      page: Number(page),
      limit: Number(limit),
      sort: { createdAt: -1 },
      lean: true,
    };

    const result = await Category.paginate(query, options);

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================
   TREE
========================= */
export const getCategoryTree = async (req, res) => {
  try {
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

    const tree = buildTree(null);

    res.json(tree);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================
   GET BY ID
========================= */
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

/* =========================
   UPDATE
========================= */
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = { ...req.body };

    const category = await Category.findById(id);

    if (!category || category.isDeleted) {
      return res.status(404).json({
        message: "Danh mục không tồn tại",
      });
    }

    if (payload.name) {
      payload.slug = slugify(payload.name, { lower: true });

      const existed = await Category.findOne({
        slug: payload.slug,
        _id: { $ne: id },
        isDeleted: false,
      });

      if (existed) {
        return res.status(400).json({
          message: "Slug đã tồn tại",
        });
      }
    }

    // if a new image file is provided, upload and replace
    if (req.file) {
      // remove previous image from cloudinary if exists
      if (category.image && category.image.public_id) {
        await cloudinary.uploader.destroy(category.image.public_id);
      }
      const file = req.file;
      const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
      const result = await cloudinary.uploader.upload(dataUri, {
        folder: "categories",
      });
      payload.image = {
        url: result.secure_url,
        public_id: result.public_id,
      };
    }

    const updated = await Category.findByIdAndUpdate(id, payload, {
      new: true,
    });

    res.json({
      message: "Cập nhật thành công",
      category: updated,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================
   SOFT DELETE
========================= */
export const softDeleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // check has children
    const hasChildren = await Category.findOne({
      parentId: id,
      isDeleted: false,
    });

    if (hasChildren) {
      return res.status(400).json({
        message: "Không thể xoá vì có danh mục con",
      });
    }

    await Category.findByIdAndUpdate(id, {
      isDeleted: true,
      status: "inactive",
    });

    res.json({ message: "Đã xoá danh mục" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================
   HARD DELETE
========================= */
export const hardDeleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        message: "Danh mục không tồn tại",
      });
    }

    await category.deleteOne();

    res.json({ message: "Đã xoá vĩnh viễn" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
