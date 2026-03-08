import Joi from "joi";

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

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
