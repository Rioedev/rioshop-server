import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const variantSchema = new mongoose.Schema(
  {
    variantId: { type: String, required: true },
    sku: { type: String, required: true, unique: true },
    color: {
      name: String,
      hex: String,
      imageUrl: String,
    },
    size: {
      type: String,
      required: true,
      enum: ["XS", "S", "M", "L", "XL", "2XL", "3XL"],  
    },
    sizeLabel: String,
    additionalPrice: { type: Number, default: 0 },
    barcode: String,
    images: [String],
    isActive: { type: Boolean, default: true },
    position: Number,
  },
  { _id: false },
);

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    type: { type: String, required: true, enum: ["image", "video", "360"] },
    altText: String,
    colorRef: String,
    isPrimary: Boolean,
    position: Number,
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true },
    slug: { type: String, required: true },
    name: { type: String, required: true },
    brand: { type: String, required: true },
    description: String,
    shortDescription: String,
    category: {
      _id: mongoose.Schema.Types.ObjectId,
      name: String,
      slug: String,
      ancestors: [
        {
          _id: mongoose.Schema.Types.ObjectId,
          name: String,
          slug: String,
        },
      ],
    },
    tags: [String],
    gender: { type: String, enum: ["men", "women", "unisex", "kids"] },
    ageGroup: { type: String, enum: ["adult", "teen", "kids", "baby"] },
    material: [String],
    care: [String],
    origin: String,
    variants: [variantSchema],
    media: [mediaSchema],
    sizeChart: {
      unit: String,
      rows: [
        {
          size: String,
          chest: Number,
          length: Number,
          shoulder: Number,
        },
      ],
    },
    pricing: {
      basePrice: { type: Number, required: true },
      salePrice: { type: Number, required: true },
      currency: { type: String, default: "VND" },
    },
    inventorySummary: {
      total: { type: Number, default: 0 },
      available: { type: Number, default: 0 },
      reserved: { type: Number, default: 0 },
    },
    ratings: {
      avg: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
      dist: {
        5: { type: Number, default: 0 },
        4: { type: Number, default: 0 },
        3: { type: Number, default: 0 },
        2: { type: Number, default: 0 },
        1: { type: Number, default: 0 },
      },
    },
    returnPolicy: {
      days: Number,
      conditions: String,
      freeReturn: Boolean,
    },
    seoMeta: {
      title: String,
      description: String,
      keywords: [String],
    },
    status: {
      type: String,
      enum: ["draft", "active", "archived", "out_of_stock"],
      default: "draft",
    },
    isFeatured: Boolean,
    isNew: Boolean,
    isBestseller: Boolean,
    weight: Number,
    dimensions: {
      lengthCm: Number,
      widthCm: Number,
      heightCm: Number,
    },
    totalSold: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    publishedAt: Date,
  },
  { suppressReservedKeysWarning: true },
);

productSchema.plugin(mongoosePaginate);

// Indexes
productSchema.index(
  { slug: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  },
);
productSchema.index(
  { sku: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  },
);
// productSchema.index({ "variants.sku": 1 });
productSchema.index({ "category._id": 1, status: 1 });
productSchema.index({ status: 1, isFeatured: 1 });
productSchema.index({ "ratings.avg": -1, totalSold: -1 });
productSchema.index({ tags: 1 });
productSchema.index({ name: "text", description: "text" });
productSchema.index({ gender: 1, status: 1 });
productSchema.index({ "pricing.salePrice": 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ deletedAt: 1 });

export default mongoose.model("Product", productSchema);
