import Joi from "joi";

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

export const getLowStockValidation = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    threshold: Joi.number().min(0).optional(),
  }).required(),
});

export const variantSkuValidation = Joi.object({
  params: Joi.object({
    variantSku: Joi.string().trim().min(1).required(),
  }).required(),
});

export const getInventoryBySkuValidation = Joi.object({
  params: Joi.object({
    variantSku: Joi.string().trim().min(1).required(),
  }).required(),
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }).required(),
});

export const updateInventoryValidation = Joi.object({
  params: Joi.object({
    variantSku: Joi.string().trim().min(1).required(),
  }).required(),
  body: Joi.object({
    productId: objectId.optional(),
    onHand: Joi.number().integer().min(0).optional(),
    reserved: Joi.number().integer().min(0).optional(),
    incoming: Joi.number().integer().min(0).optional(),
    reorderPoint: Joi.number().integer().min(0).allow(null).optional(),
    reorderQty: Joi.number().integer().min(0).allow(null).optional(),
    lowStockAlert: Joi.boolean().optional(),
    lastCountAt: Joi.date().iso().allow(null).optional(),
  })
    .min(1)
    .required(),
});
