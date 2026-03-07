import mongoose from "mongoose";

const analyticsEventSchema = new mongoose.Schema({
  event: {
    type: String,
    enum: [
      "page_view",
      "product_view",
      "add_to_cart",
      "purchase",
      "search",
      "click",
    ],
    required: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  sessionId: { type: String, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  properties: mongoose.Schema.Types.Mixed,
  device: {
    type: String,
    os: String,
    browser: String,
  },
  ip: String,
  utm: {
    source: String,
    medium: String,
    campaign: String,
    term: String,
    content: String,
  },
  createdAt: { type: Date, default: Date.now },
});

// TTL index - 365 days retention
analyticsEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });
analyticsEventSchema.index({ userId: 1, event: 1, createdAt: -1 });
analyticsEventSchema.index({ event: 1, createdAt: -1 });
analyticsEventSchema.index({ productId: 1, event: 1 });

export default mongoose.model("AnalyticsEvent", analyticsEventSchema);
