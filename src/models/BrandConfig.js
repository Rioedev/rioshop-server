import mongoose from "mongoose";

const brandConfigSchema = new mongoose.Schema({
  brandKey: { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  logo: {
    light: String,
    dark: String,
  },
  theme: {
    primaryColor: String,
    secondaryColor: String,
    fontFamily: String,
  },
  paymentGateways: [
    {
      provider: String,
      isActive: Boolean,
      config: mongoose.Schema.Types.Mixed,
    },
  ],
  shippingRules: [
    {
      method: String,
      carriers: [String],
      feeSchedule: mongoose.Schema.Types.Mixed,
    },
  ],
  taxRate: Number,
  supportEmail: String,
  supportPhone: String,
  socialLinks: {
    facebook: String,
    instagram: String,
    tiktok: String,
    youtube: String,
  },
  featureFlags: {
    loyalty: { type: Boolean, default: true },
    flashSale: { type: Boolean, default: true },
    review: { type: Boolean, default: true },
  },
  maintenanceMode: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes
export default mongoose.model("BrandConfig", brandConfigSchema);
