import Category from "../models/category.model.js";
import slugify from "slugify";

export const createCategory = async (req, res) => {
  try {
    const payload = req.body;

    payload.slug = slugify(payload.name, { lower: true });

    const category = await Category.create(payload);

    res.status(201).json(category);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isDeleted: false })
      .sort({ sortOrder: 1 });

    res.json(categories);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCategoryTree = async (req, res) => {
  try {
    const categories = await Category.find({
      isDeleted: false,
      status: "active"
    });

    const buildTree = (parentId = null) => {
      return categories
        .filter(cat =>
          String(cat.parentId) === String(parentId)
        )
        .map(cat => ({
          ...cat._doc,
          children: buildTree(cat._id)
        }));
    };

    const tree = buildTree(null);

    res.json(tree);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const payload = req.body;

    if (payload.name) {
      payload.slug = slugify(payload.name, { lower: true });
    }

    const category = await Category.findByIdAndUpdate(
      id,
      payload,
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ message: "Danh mục không tồn tại" });
    }

    res.json(category);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const softDeleteCategory = async (req, res) => {
  try {
    await Category.findByIdAndUpdate(req.params.id, {
      isDeleted: true,
      status: "inactive"
    });

    res.json({ message: "Đã xoá danh mục" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const hardDeleteCategory = async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);

    res.json({ message: "Đã xoá vĩnh viễn" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};