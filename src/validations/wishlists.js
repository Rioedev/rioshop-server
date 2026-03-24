import Joi from "joi";

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

export const addWishlistItemValidation = Joi.object({
  body: Joi.object({
    productId: objectId.required(),
    productSlug: Joi.string().trim().allow("").optional(),
    variantSku: Joi.string().allow("", null).optional(),
    name: Joi.string().trim().min(1).required(),
    image: Joi.string().trim().min(1).required(),
    price: Joi.number().min(0).required(),
  }).required(),
});

export const removeWishlistItemValidation = Joi.object({
  params: Joi.object({
    productId: objectId.required(),
  }).required(),
  query: Joi.object({
    variantSku: Joi.string().allow("", null).optional(),
  }).required(),
});
