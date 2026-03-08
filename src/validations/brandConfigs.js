import Joi from "joi";

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
    maintenanceMode: Joi.boolean().optional(),
  })
    .min(1)
    .required(),
});
