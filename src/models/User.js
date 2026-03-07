import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    id: String,
    label: String,
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    province: {
      code: String,
      name: String,
    },
    district: {
      code: String,
      name: String,
    },
    ward: {
      code: String,
      name: String,
    },
    street: { type: String, required: true },
    isDefault: Boolean,
  },
  { _id: false },
);

const loyaltySchema = new mongoose.Schema(
  {
    tier: {
      type: String,
      enum: ["bronze", "silver", "gold", "platinum"],
      default: "bronze",
    },
    points: { type: Number, default: 0 },
    lifetimePoints: { type: Number, default: 0 },
    tierExpiresAt: Date,
    pointsHistory: [
      {
        delta: Number,
        reason: String,
        date: { type: Date, default: Date.now },
      }
    ],
  },
  { _id: false },
);

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, required: true, unique: true },
  passwordHash: String,
  fullName: { type: String, required: true },
  avatar: String,
  gender: { type: String, enum: ["male", "female", "other"] },
  dateOfBirth: Date,
  addresses: [addressSchema],
  defaultAddressId: String,
  loyalty: { type: loyaltySchema, default: () => ({}) },
  preferences: {
    newsletter: { type: Boolean, default: true },
    smsAlert: { type: Boolean, default: true },
    favoriteCategories: [String],
  },
  oauthProviders: [
    {
      provider: String,
      providerId: String,
      email: String,
    },
  ],
  emailVerified: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ["active", "banned", "inactive"],
    default: "active",
  },
  lastLoginAt: Date,
  loginCount: { type: Number, default: 0 },
  referralCode: { type: String, unique: true },
  referredBy: mongoose.Schema.Types.ObjectId,
  totalOrders: { type: Number, default: 0 },
  totalSpend: { type: Number, default: 0 },
  tags: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 }, { sparse: true });
userSchema.index({ referralCode: 1 });
userSchema.index({ status: 1, createdAt: 1 });
userSchema.index({ "loyalty.tier": 1 });
userSchema.index({
  "oauthProviders.provider": 1,
  "oauthProviders.providerId": 1,
});

export default mongoose.model("User", userSchema);