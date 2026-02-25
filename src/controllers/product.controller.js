import Product from "../models/product.model.js";
import slugify from "slugify"
import cloudinary from "../config/cloudinary.js"

/**
 * CREATE PRODUCT
 */
// controllers/product.controller.js

export const createProduct = async (req, res) => {
  try {
    const payload = req.body

    // slug auto
    payload.slug = slugify(payload.name, { lower: true })

    // Upload images cho từng color
    if (payload.options?.colors?.length > 0) {
      for (let color of payload.options.colors) {
        if (color.images?.length > 0) {
          const uploadedImages = []

          for (let file of color.images) {
            const result = await cloudinary.uploader.upload(file, {
              folder: "products"
            })

            uploadedImages.push({
              url: result.secure_url,
              public_id: result.public_id,
              isThumbnail: file.isThumbnail || false
            })
          }

          color.images = uploadedImages
        }
      }
    }

    const product = await Product.create(payload)

    res.status(201).json(product)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
/**
 * UPDATE PRODUCT
 */
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params
    const payload = req.body

    const product = await Product.findOne({ _id: id, isDeleted: false })

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    // slug update nếu đổi tên
    if (payload.name) {
      payload.slug = slugify(payload.name, { lower: true })
    }

    // ===== HANDLE COLORS UPDATE =====
    if (payload.options?.colors) {

      // Xoá ảnh của color bị remove
      const oldColorIds = product.options.colors.map(c => c._id.toString())
      const newColorIds = payload.options.colors
        .filter(c => c._id)
        .map(c => c._id)

      const removedColors = oldColorIds.filter(id => !newColorIds.includes(id))

      for (let color of product.options.colors) {
        if (removedColors.includes(color._id.toString())) {
          for (let img of color.images) {
            await cloudinary.uploader.destroy(img.public_id)
          }
        }
      }

      // Upload ảnh mới nếu có base64
      for (let color of payload.options.colors) {
        if (color.images?.length > 0) {
          const processedImages = []

          for (let img of color.images) {

            // Nếu đã có public_id → giữ nguyên
            if (img.public_id) {
              processedImages.push(img)
            } else {
              const result = await cloudinary.uploader.upload(img, {
                folder: "products"
              })

              processedImages.push({
                url: result.secure_url,
                public_id: result.public_id,
                isThumbnail: false
              })
            }
          }

          color.images = processedImages
        }
      }
    }

    Object.assign(product, payload)

    await product.save()

    res.json(product)

  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
/**
 * SOFT DELETE PRODUCT
 */
export const softDeleteProduct = async (req, res) => {
  try {
    const { id } = req.params

    const product = await Product.findByIdAndUpdate(
      id,
      { isDeleted: true, status: "archived" },
      { new: true }
    )

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    res.json({ message: "Product archived successfully" })

  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const restoreProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isDeleted: false, status: "draft" },
      { new: true }
    )

    res.json(product)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const hardDeleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    // Xoá toàn bộ ảnh cloudinary
    for (let color of product.options.colors) {
      for (let img of color.images) {
        await cloudinary.uploader.destroy(img.public_id)
      }
    }

    await product.deleteOne()

    res.json({ message: "Product permanently deleted" })

  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
/**
 * GET PRODUCT LIST
 */
export const getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      keyword,
      status
    } = req.query

    const query = { isDeleted: false }

    if (status) query.status = status

    if (keyword) {
      query.name = { $regex: keyword, $options: "i" }
    }

    const products = await Product.find(query)
      .populate("categoryIds")
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 })

    const total = await Product.countDocuments(query)

    res.json({
      data: products,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit)
    })

  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isDeleted: false
    }).populate("categoryIds")

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    res.json(product)

  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}