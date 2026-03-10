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

const returnRequestSchema = new mongoose.Schema(
  {
    reason: String,
    images: [String],
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "completed"],
    },
    requestedAt: Date,
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

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  customerSnapshot: {
    name: { type: String, required: true },
    email: String,
    phone: String,
  },
  items: [orderItemSchema],
  shippingAddress: mongoose.Schema.Types.Mixed,
  pricing: pricingSchema,
  couponCode: String,
  couponDiscount: Number,
  loyaltyPointsUsed: Number,
  loyaltyPointsEarned: Number,
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
      "shipping",
      "delivered",
      "cancelled",
      "returned",
    ],
    default: "pending",
  },
  timeline: [timelineSchema],
  note: String,
  adminNote: String,
  returnRequest: returnRequestSchema,
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
