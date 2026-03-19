import mongoose from "mongoose";

const metricSchema = new mongoose.Schema(
  {
    value: String,
    label: String,
  },
  { _id: false },
);

const valuePropSchema = new mongoose.Schema(
  {
    title: String,
    text: String,
    iconKey: String,
  },
  { _id: false },
);

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
  storefront: {
    home: {
      hero: {
        kicker: String,
        titleLine1: String,
        titleLine2: String,
        description: String,
        primaryCtaLabel: String,
        secondaryCtaLabel: String,
        dealDescription: String,
        sideKicker: String,
        sideTitleLine1: String,
        sideTitleLine2: String,
        sideDescription: String,
        dealCtaLabel: String,
        sideCtaLabel: String,
        metrics: [metricSchema],
      },
      sections: {
        categoriesMiniTitle: String,
        categoriesTitle: String,
        categoriesLinkLabel: String,
        flashSaleMiniTitle: String,
        flashSaleTitle: String,
        flashSaleLinkLabel: String,
        productsMiniTitle: String,
        productsTitle: String,
        productsLinkLabel: String,
      },
      labels: {
        flashDeal: String,
        soldPercentPrefix: String,
        soldOutSoon: String,
        dealFallbackTitle: String,
        buyDeal: String,
        exploreNow: String,
        noCategories: String,
        noFlashSales: String,
        noProducts: String,
        loadingCategories: String,
        loadingFlashSales: String,
        loadingProducts: String,
      },
      valueProps: [valuePropSchema],
      journal: {
        kicker: String,
        titleLine1: String,
        titleLine2: String,
        description: String,
        ctaLabel: String,
      },
      member: {
        kicker: String,
        title: String,
        description: String,
        emailPlaceholder: String,
        ctaLabel: String,
      },
      apiNotice: String,
    },
  },
  maintenanceMode: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes
export default mongoose.model("BrandConfig", brandConfigSchema);
