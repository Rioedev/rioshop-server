import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantSku: { type: String, required: true },
    productName: { type: String, required: true },
    variantLabel: { type: String, required: true },
    image: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    // Gia von trung binh tai thoi diem tao don. Dung de bao cao lai gop khong bi
    // thay doi khi nhap hang dot sau voi gia von khac.
    costPriceSnapshot: { type: Number, default: 0 },
    // listPrice = giá niêm yết tại thời điểm đặt (để dựng lại "giảm bao nhiêu")
    listPrice: { type: Number, default: 0 },
    // priceSource = "regular" | "flash_sale" — đơn này áp giá gì
    priceSource: { type: String, enum: ["regular", "flash_sale"], default: "regular" },
    flashSaleId: { type: mongoose.Schema.Types.ObjectId, ref: "FlashSale", default: null },
    quantity: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    returnedQty: { type: Number, default: 0 },
  },
  { _id: false },
);

const timelineSchema = new mongoose.Schema(
  {
    status: String,
    note: String,
    at: { type: Date, default: Date.now },
    by: String,
  },
  { _id: false },
);

const exchangeItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    originalVariantSku: { type: String, required: true },
    originalVariantLabel: { type: String, required: true },
    replacementVariantSku: { type: String, required: true },
    replacementVariantLabel: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    returnDisposition: {
      type: String,
      enum: ["restock", "quarantine"],
      required: true,
    },
  },
  { _id: false },
);

const returnRequestSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["return", "exchange"],
      default: "exchange",
    },
    reason: String,
    note: String,
    images: [String],
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "completed"],
    },
    requestedAt: Date,
    completedAt: Date,
    replacementOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    replacementOrderNumber: String,
    exchangeItems: [exchangeItemSchema],
  },
  { _id: false },
);

const pricingSchema = new mongoose.Schema(
  {
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    shippingFee: { type: Number, required: true },
    total: { type: Number, required: true },
    currency: { type: String, default: "VND" },
  },
  { _id: false },
);

// Tên / SĐT người nhận đã ở customerSnapshot. Sub-schema này chỉ phần địa chỉ
// dùng cho đối soát đơn + tích hợp GHN. Các field *Id/*Code là khóa của GHN.
const shippingAddressSchema = new mongoose.Schema(
  {
    line1: { type: String, required: true, trim: true },
    wardCode: { type: String, default: "" },
    wardName: { type: String, default: "" },
    districtId: { type: Number, default: 0 },
    districtName: { type: String, default: "" },
    provinceId: { type: Number, default: 0 },
    provinceName: { type: String, default: "" },
    city: { type: String, default: "" },
    country: { type: String, default: "Vietnam" },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  customerSnapshot: {
    name: { type: String, required: true },
    email: String,
    phone: String,
  },
  items: [orderItemSchema],
  shippingAddress: { type: shippingAddressSchema, required: true },
  pricing: pricingSchema,
  couponCode: String,
  couponType: {
    type: String,
    enum: ["percent", "fixed", "free_ship", "gift", null],
    default: null,
  },
  couponDiscount: Number,
  loyaltyPointsUsed: Number,
  loyaltyPointsEarned: Number,
  loyaltyPointsAwardedAt: Date,
  paymentMethod: {
    type: String,
    enum: ["cod", "bank_transfer", "momo", "vnpay", "zalopay", "card"],
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "refunded", "failed"],
    default: "pending",
  },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
  shippingMethod: {
    type: String,
    enum: ["standard", "express", "same_day"],
    required: true,
  },
  shippingCarrier: String,
  shipmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Shipment" },
  shippingFee: { type: Number, required: true },
  status: {
    type: String,
    enum: [
      "pending",
      "confirmed",
      "packing",
      "ready_to_ship",
      "shipping",
      "delivered",
      "completed",
      "cancelled",
      "returned",
    ],
    default: "pending",
  },
  timeline: [timelineSchema],
  note: String,
  adminNote: String,
  returnRequest: returnRequestSchema,
  exchangeMeta: {
    isReplacement: { type: Boolean, default: false },
    parentOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    parentOrderNumber: String,
  },
  source: {
    type: String,
    enum: ["web", "mobile", "pos", "admin"],
    default: "web",
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

orderSchema.plugin(mongoosePaginate);

// Indexes
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ shipmentId: 1 });
orderSchema.index({ "items.productId": 1 });
orderSchema.index({ createdAt: -1 });

export default mongoose.model("Order", orderSchema);
