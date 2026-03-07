import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const reviewSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  variantSku: String,
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: String,
  body: { type: String, required: true },
  media: [String],
  fit: { type: String, enum: ["true_to_size", "runs_small", "runs_large"] },
  quality: { type: Number, min: 1, max: 5 },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  helpfulCount: { type: Number, default: 0 },
  reported: Boolean,
  adminReply: {
    body: String,
    repliedAt: Date,
    adminId: mongoose.Schema.Types.ObjectId,
  },
  purchasedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

reviewSchema.plugin(mongoosePaginate);

// Indexes
reviewSchema.index({ productId: 1, status: 1, createdAt: -1 });
reviewSchema.index({ userId: 1 });
reviewSchema.index({ productId: 1, rating: 1 });
reviewSchema.index({ status: 1 });

export default mongoose.model("Review", reviewSchema);
