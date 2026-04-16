import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: {
    type: String,
    enum: ["order_update", "promo", "loyalty", "review_reply", "system"],
    required: true,
  },
  title: { type: String, required: true },
  body: { type: String, required: true },
  imageUrl: String,
  link: String,
  isRead: { type: Boolean, default: false },
  readAt: Date,
  channel: {
    type: [String],
    enum: ["in_app", "push", "email", "sms"],
    default: ["in_app"],
  },
  createdAt: { type: Date, default: Date.now },
});

// TTL index - 90 days retention
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });
notificationSchema.index({ isRead: 1, createdAt: 1 });
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
