import Joi from "joi";

const metricSchema = Joi.object({
  value: Joi.string().trim().max(40).required(),
  label: Joi.string().trim().max(160).required(),
});

const valuePropSchema = Joi.object({
  title: Joi.string().trim().max(120).required(),
  text: Joi.string().trim().max(500).required(),
  iconKey: Joi.string().trim().max(40).optional(),
});

const storefrontHomeSchema = Joi.object({
  hero: Joi.object({
    kicker: Joi.string().trim().max(120).optional(),
    titleLine1: Joi.string().trim().max(160).optional(),
    titleLine2: Joi.string().trim().max(160).optional(),
    description: Joi.string().trim().max(600).optional(),
    primaryCtaLabel: Joi.string().trim().max(80).optional(),
    secondaryCtaLabel: Joi.string().trim().max(80).optional(),
    dealDescription: Joi.string().trim().max(300).optional(),
    sideKicker: Joi.string().trim().max(120).optional(),
    sideTitleLine1: Joi.string().trim().max(160).optional(),
    sideTitleLine2: Joi.string().trim().max(160).optional(),
    sideDescription: Joi.string().trim().max(400).optional(),
    dealCtaLabel: Joi.string().trim().max(80).optional(),
    sideCtaLabel: Joi.string().trim().max(80).optional(),
    metrics: Joi.array().items(metricSchema).max(6).optional(),
  }).optional(),
  sections: Joi.object({
    categoriesMiniTitle: Joi.string().trim().max(120).optional(),
    categoriesTitle: Joi.string().trim().max(160).optional(),
    categoriesLinkLabel: Joi.string().trim().max(80).optional(),
    flashSaleMiniTitle: Joi.string().trim().max(120).optional(),
    flashSaleTitle: Joi.string().trim().max(160).optional(),
    flashSaleLinkLabel: Joi.string().trim().max(80).optional(),
    productsMiniTitle: Joi.string().trim().max(120).optional(),
    productsTitle: Joi.string().trim().max(160).optional(),
    productsLinkLabel: Joi.string().trim().max(80).optional(),
  }).optional(),
  labels: Joi.object({
    flashDeal: Joi.string().trim().max(80).optional(),
    soldPercentPrefix: Joi.string().trim().max(60).optional(),
    soldOutSoon: Joi.string().trim().max(60).optional(),
    dealFallbackTitle: Joi.string().trim().max(120).optional(),
    buyDeal: Joi.string().trim().max(80).optional(),
    exploreNow: Joi.string().trim().max(80).optional(),
    noCategories: Joi.string().trim().max(200).optional(),
    noFlashSales: Joi.string().trim().max(200).optional(),
    noProducts: Joi.string().trim().max(200).optional(),
    loadingCategories: Joi.string().trim().max(200).optional(),
    loadingFlashSales: Joi.string().trim().max(200).optional(),
    loadingProducts: Joi.string().trim().max(200).optional(),
  }).optional(),
  valueProps: Joi.array().items(valuePropSchema).max(6).optional(),
  journal: Joi.object({
    kicker: Joi.string().trim().max(120).optional(),
    titleLine1: Joi.string().trim().max(160).optional(),
    titleLine2: Joi.string().trim().max(160).optional(),
    description: Joi.string().trim().max(600).optional(),
    ctaLabel: Joi.string().trim().max(80).optional(),
  }).optional(),
  member: Joi.object({
    kicker: Joi.string().trim().max(120).optional(),
    title: Joi.string().trim().max(200).optional(),
    description: Joi.string().trim().max(600).optional(),
    emailPlaceholder: Joi.string().trim().max(120).optional(),
    ctaLabel: Joi.string().trim().max(80).optional(),
  }).optional(),
  apiNotice: Joi.string().trim().max(300).optional(),
});

export const getBrandConfigValidation = Joi.object({
  params: Joi.object({
    brandKey: Joi.string().trim().min(2).max(100).required(),
  }).required(),
});

export const updateBrandConfigValidation = Joi.object({
  params: Joi.object({
    brandKey: Joi.string().trim().min(2).max(100).required(),
  }).required(),
  body: Joi.object({
    displayName: Joi.string().trim().min(2).max(150).optional(),
    logo: Joi.object({
      light: Joi.string().uri().allow("", null).optional(),
      dark: Joi.string().uri().allow("", null).optional(),
    }).optional(),
    theme: Joi.object({
      primaryColor: Joi.string().max(32).allow("", null).optional(),
      secondaryColor: Joi.string().max(32).allow("", null).optional(),
      fontFamily: Joi.string().max(100).allow("", null).optional(),
    }).optional(),
    paymentGateways: Joi.array()
      .items(
        Joi.object({
          provider: Joi.string().required(),
          isActive: Joi.boolean().optional(),
          config: Joi.object().unknown(true).optional(),
        }),
      )
      .optional(),
    shippingRules: Joi.array()
      .items(
        Joi.object({
          method: Joi.string().required(),
          carriers: Joi.array().items(Joi.string()).optional(),
          feeSchedule: Joi.object().unknown(true).optional(),
        }),
      )
      .optional(),
    taxRate: Joi.number().min(0).optional(),
    supportEmail: Joi.string().email().allow("", null).optional(),
    supportPhone: Joi.string().allow("", null).optional(),
    socialLinks: Joi.object().unknown(true).optional(),
    featureFlags: Joi.object({
      loyalty: Joi.boolean().optional(),
      flashSale: Joi.boolean().optional(),
      review: Joi.boolean().optional(),
    }).optional(),
    storefront: Joi.object({
      home: storefrontHomeSchema.optional(),
    }).optional(),
    maintenanceMode: Joi.boolean().optional(),
  })
    .min(1)
    .required(),
});
