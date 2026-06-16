import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const variantSchema = new mongoose.Schema(
  {
    variantId: { type: String, required: true },
    sku: { type: String, required: true },
    color: {
      name: String,
      hex: String,
      imageUrl: String,
    },
    size: {
      type: String,
      required: true,
    },
    sizeLabel: String,
    stock: { type: Number, default: 0, min: 0 },
    // Số lượng đã đặt PO nhưng CHƯA về kho. Tăng khi PO confirm, giảm khi receive.
    incoming: { type: Number, default: 0, min: 0 },
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

const collectionRefSchema = new mongoose.Schema(
  {
    _id: mongoose.Schema.Types.ObjectId,
    name: String,
    slug: String,
    image: String,
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
    collections: [collectionRefSchema],
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
          waist: Number,
          hip: Number,
          length: Number,
          shoulder: Number,
        },
      ],
    },
    // pricing.regularPrice = giá bán thường ngày của sản phẩm (required về mặt nghiệp vụ)
    // pricing.compareAtPrice = giá tham chiếu/niêm yết/MSRP để so sánh khi có giảm giá (optional)
    // pricing.salePrice/basePrice = alias legacy, giữ để dữ liệu cũ và client cũ không bị gãy.
    // pricing.costPrice = giá vốn TRUNG BÌNH TRỌNG SỐ ở cấp PRODUCT (mọi variant
    //   dùng chung 1 giá vốn). Cập nhật khi nhận hàng từ PO theo công thức
    //   (oldTotalStock × oldCost + Σ qty_i × cost_i) / (oldTotalStock + Σ qty_i).
    //   Admin KHÔNG sửa được trực tiếp.
    pricing: {
      regularPrice: { type: Number, default: 0 },
      compareAtPrice: { type: Number, default: 0 },
      salePrice: { type: Number, default: undefined },
      basePrice: { type: Number, default: undefined },
      costPrice: { type: Number, default: 0 },
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

const pickLegacyAwarePrice = (canonical, legacy) => {
  const canonicalNumber = Number(canonical);
  const legacyNumber = Number(legacy);

  if (Number.isFinite(canonicalNumber) && canonicalNumber > 0) {
    return Math.max(0, canonicalNumber);
  }
  if (Number.isFinite(legacyNumber) && legacyNumber > 0) {
    return Math.max(0, legacyNumber);
  }
  if (Number.isFinite(canonicalNumber)) {
    return Math.max(0, canonicalNumber);
  }
  if (Number.isFinite(legacyNumber)) {
    return Math.max(0, legacyNumber);
  }
  return 0;
};

const normalizePricingSemantics = (doc) => {
  if (!doc) return;
  const pricing = doc.pricing || {};
  const regularPrice = pickLegacyAwarePrice(pricing.regularPrice, pricing.salePrice);
  const compareAtPrice = pickLegacyAwarePrice(pricing.compareAtPrice, pricing.basePrice);

  doc.pricing = {
    ...pricing,
    regularPrice,
    compareAtPrice,
    // Legacy aliases. Remove after a data migration and client cleanup.
    salePrice: regularPrice,
    basePrice: compareAtPrice,
  };
};

productSchema.pre("validate", function normalizePricingForValidation() {
  normalizePricingSemantics(this);
});

productSchema.post("init", function normalizePricingForLegacyReads(doc) {
  normalizePricingSemantics(doc);
});

productSchema.pre("save", function synchronizeInventorySummary() {
  const variants = Array.isArray(this.variants) ? this.variants : [];
  const available = variants.reduce(
    (sum, variant) => sum + Math.max(0, Number(variant?.stock || 0)),
    0,
  );
  const reserved = Math.max(0, Number(this.inventorySummary?.reserved || 0));

  this.inventorySummary = {
    total: available + reserved,
    available,
    reserved,
  };

  if (this.status === "active" && available <= 0) {
    this.status = "out_of_stock";
  } else if (this.status === "out_of_stock" && available > 0) {
    this.status = "active";
  }

  this.updatedAt = new Date();
});

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
productSchema.index({ "collections._id": 1, status: 1 });
productSchema.index({ status: 1, isFeatured: 1 });
productSchema.index({ "ratings.avg": -1, totalSold: -1 });
productSchema.index({ tags: 1 });
productSchema.index({ name: "text", description: "text" });
productSchema.index({ gender: 1, status: 1 });
productSchema.index({ "pricing.regularPrice": 1 });
productSchema.index({ "pricing.salePrice": 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ status: 1, publishedAt: -1 });
productSchema.index({ deletedAt: 1 });

export default mongoose.model("Product", productSchema);
