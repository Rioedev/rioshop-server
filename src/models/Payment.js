import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  method: {
    type: String,
    enum: ["momo", "vnpay", "zalopay", "cod", "bank_transfer", "card"],
    required: true,
  },
  gateway: String,
  gatewayTxId: String,
  amount: { type: Number, required: true },
  currency: { type: String, default: "VND" },
  status: {
    type: String,
    enum: ["pending", "success", "failed", "refunded"],
    default: "pending",
  },
  paidAt: Date,
  gatewayResponse: mongoose.Schema.Types.Mixed,
  refunds: [
    {
      amount: Number,
      reason: String,
      status: String,
      processedAt: Date,
      refundId: String,
    },
  ],
  ipAddress: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes
paymentSchema.index({ orderId: 1 });
paymentSchema.index({ gatewayTxId: 1 }, { sparse: true });
paymentSchema.index({ status: 1, createdAt: 1 });

export default mongoose.model("Payment", paymentSchema);
