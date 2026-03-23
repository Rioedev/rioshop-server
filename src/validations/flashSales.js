import Joi from "joi";

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);
const flashSaleSlotSchema = Joi.object({
  productId: objectId.required(),
  variantSku: Joi.string().allow("", null).optional(),
  salePrice: Joi.number().min(0).required(),
  stockLimit: Joi.number().integer().min(0).required(),
  sold: Joi.number().integer().min(0).optional(),
});

export const getFlashSalesValidation = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    currentOnly: Joi.boolean().truthy("true").falsy("false").optional(),
    isActive: Joi.boolean().truthy("true").falsy("false").optional(),
  }).required(),
});

export const flashSaleIdValidation = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }).required(),
});

export const createFlashSaleValidation = Joi.object({
  body: Joi.object({
    name: Joi.string().trim().min(2).max(150).required(),
    banner: Joi.string().uri().allow("", null).optional(),
    startsAt: Joi.date().iso().required(),
    endsAt: Joi.date().iso().required(),
    isActive: Joi.boolean().optional(),
    createdBy: objectId.optional(),
    slots: Joi.array().items(flashSaleSlotSchema).min(1).required(),
  }).required(),
});

export const updateFlashSaleValidation = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }).required(),
  body: Joi.object({
    name: Joi.string().trim().min(2).max(150).optional(),
    banner: Joi.string().uri().allow("", null).optional(),
    startsAt: Joi.date().iso().optional(),
    endsAt: Joi.date().iso().optional(),
    isActive: Joi.boolean().optional(),
    slots: Joi.array().items(flashSaleSlotSchema).min(1).optional(),
  })
    .min(1)
    .required(),
});
