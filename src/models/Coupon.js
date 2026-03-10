import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  name: { type: String, required: true },
  description: String,
  type: {
    type: String,
    enum: ["percent", "fixed", "free_ship", "gift"],
    required: true,
  },
  value: { type: Number, required: true },
  maxDiscount: Number,
  minOrderValue: Number,
  applicableTo: {
    categories: [mongoose.Schema.Types.ObjectId],
    products: [mongoose.Schema.Types.ObjectId],
    brands: [String],
  },
  excludedProducts: [mongoose.Schema.Types.ObjectId],
  eligibleTiers: [
    { type: String, enum: ["bronze", "silver", "gold", "platinum"] },
  ],
  eligibleUsers: [mongoose.Schema.Types.ObjectId],
  usageLimit: Number,
  perUserLimit: { type: Number, default: 1 },
  usageCount: { type: Number, default: 0 },
  usedBy: [
    {
      userId: mongoose.Schema.Types.ObjectId,
      orderId: mongoose.Schema.Types.ObjectId,
      usedAt: Date,
    },
  ],
  isActive: { type: Boolean, default: true },
  startsAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  source: {
    type: String,
    enum: ["campaign", "referral", "birthday", "manual"],
  },
  createdBy: mongoose.Schema.Types.ObjectId,
  createdAt: { type: Date, default: Date.now },
});

// Indexes
couponSchema.index({ isActive: 1, startsAt: 1, expiresAt: 1 });
couponSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Coupon", couponSchema);
