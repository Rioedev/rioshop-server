import mongoose from "mongoose";

/**
 * COLOR SCHEMA
 * Mỗi màu có bộ ảnh riêng
 */
const colorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    code: {
      type: String,
      required: true
    },

    images: [
      {
        url: { type: String, required: true },
        public_id: { type: String, required: true },
        isThumbnail: { type: Boolean, default: false }
      }
    ]
  },
  { _id: true }
);

/**
 * VARIANT SCHEMA
 * Đơn vị bán thực tế (color + size)
 */
const variantSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: true,
      trim: true
    },

    colorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },

    size: {
      type: String,
      required: true
    },

    price: {
      type: Number,
      required: true
    },

    originalPrice: Number,

    stock: {
      type: Number,
      default: 0
    },

    reservedStock: {
      type: Number,
      default: 0
    },

    status: {
      type: String,
      enum: ["available", "out_of_stock", "hidden"],
      default: "available"
    }
  },
  { _id: true }
);

/**
 * PRODUCT SCHEMA
 */
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    slug: {
      type: String,
      required: true,
    },

    brand: {
      type: String,
      default: "Rioshop"
    },

    categoryIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category"
      }
    ],

    /**
     * OPTIONS
     */
    options: {
      colors: [colorSchema],
      sizes: [
        {
          type: String
        }
      ]
    },

    /**
     * VARIANTS
     */
    variants: [variantSchema],

    /**
     * THÔNG SỐ
     */
    specs: {
      gender: {
        type: String,
        enum: ["male", "female", "unisex"]
      },

      fit: {
        type: String,
        enum: ["slim", "regular", "oversize"]
      },

      materials: [String],

      seasons: [String],

      attributes: [
        {
          k: String,
          v: String
        }
      ]
    },

    /**
     * STATISTICS (denormalized)
     */
    statistics: {
      minPrice: { type: Number, default: 0 },
      maxPrice: { type: Number, default: 0 },
      totalStock: { type: Number, default: 0 },
      soldCount: { type: Number, default: 0 },
      ratingAvg: { type: Number, default: 0 },
      ratingCount: { type: Number, default: 0 }
    },

    seo: {
      title: String,
      description: String,
      keywords: [String]
    },

    status: {
      type: String,
      enum: ["draft", "review", "published", "archived"],
      default: "draft"
    },

    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

/**
 * AUTO UPDATE STATISTICS
 */
productSchema.pre("save", function (next) {
  if (this.variants && this.variants.length > 0) {
    const prices = this.variants.map(v => v.price);

    this.statistics.minPrice = Math.min(...prices);
    this.statistics.maxPrice = Math.max(...prices);

    this.statistics.totalStock = this.variants.reduce(
      (sum, v) => sum + v.stock,
      0
    );
  }

  next();
});

/**
 * INDEX
 */
productSchema.index({ slug: 1 });
productSchema.index({ "variants.sku": 1 });
productSchema.index({ status: 1 });
productSchema.index({ isDeleted: 1 });

export default mongoose.model("Product", productSchema);