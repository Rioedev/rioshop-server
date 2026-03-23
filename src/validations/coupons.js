import Joi from "joi";

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);
const couponType = Joi.string().valid("percent", "fixed", "free_ship", "gift");
const couponSource = Joi.string().valid("campaign", "referral", "birthday", "manual");

const applicableToValidation = Joi.object({
  categories: Joi.array().items(objectId).optional(),
  products: Joi.array().items(objectId).optional(),
  brands: Joi.array().items(Joi.string().trim()).optional(),
}).optional();

const commonCouponBody = {
  code: Joi.string().trim().min(2).max(50),
  name: Joi.string().trim().min(2).max(120),
  description: Joi.string().allow("", null),
  type: couponType,
  value: Joi.number().min(0),
  maxDiscount: Joi.number().min(0).allow(null),
  minOrderValue: Joi.number().min(0).allow(null),
  usageLimit: Joi.number().integer().min(0).allow(null),
  perUserLimit: Joi.number().integer().min(0).allow(null),
  isActive: Joi.boolean(),
  startsAt: Joi.date().iso(),
  expiresAt: Joi.date().iso(),
  source: couponSource.allow(null),
  applicableTo: applicableToValidation,
  excludedProducts: Joi.array().items(objectId).optional(),
  eligibleUsers: Joi.array().items(objectId).optional(),
  eligibleTiers: Joi.array()
    .items(Joi.string().valid("bronze", "silver", "gold", "platinum"))
    .optional(),
};

export const validateCouponValidation = Joi.object({
  body: Joi.object({
    code: Joi.string().trim().min(2).max(50).required(),
    userId: objectId.optional(),
    orderValue: Joi.number().min(0).required(),
    shippingFee: Joi.number().min(0).default(0),
    productIds: Joi.array().items(objectId).optional(),
    categoryIds: Joi.array().items(objectId).optional(),
    brandNames: Joi.array().items(Joi.string().trim()).optional(),
  }).required(),
});

export const getActiveCouponsValidation = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }).required(),
});

export const getCouponByCodeValidation = Joi.object({
  params: Joi.object({
    code: Joi.string().trim().min(2).max(50).required(),
  }).required(),
});

export const getAdminCouponsValidation = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    keyword: Joi.string().trim().allow("").optional(),
    type: couponType.optional(),
    isActive: Joi.boolean().optional(),
  }).required(),
});

export const createCouponValidation = Joi.object({
  body: Joi.object({
    ...commonCouponBody,
    code: commonCouponBody.code.required(),
    name: commonCouponBody.name.required(),
    type: commonCouponBody.type.required(),
    value: commonCouponBody.value.required(),
    startsAt: commonCouponBody.startsAt.required(),
    expiresAt: commonCouponBody.expiresAt.required(),
  }).required(),
});

export const updateCouponValidation = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }).required(),
  body: Joi.object({
    ...commonCouponBody,
  })
    .min(1)
    .required(),
});

export const deleteCouponValidation = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }).required(),
});
