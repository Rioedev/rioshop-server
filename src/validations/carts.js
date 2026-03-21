import Joi from "joi";

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

export const cartItemIdValidation = Joi.object({
  params: Joi.object({
    itemId: Joi.string().trim().min(1).required(),
  }).required(),
});

export const addToCartValidation = Joi.object({
  body: Joi.object({
    productId: objectId.required(),
    variantSku: Joi.string().trim().min(1).required(),
    quantity: Joi.number().integer().min(1).default(1),
  }).required(),
});

export const updateCartItemValidation = Joi.object({
  params: Joi.object({
    itemId: Joi.string().trim().min(1).required(),
  }).required(),
  body: Joi.object({
    quantity: Joi.number().integer().min(0).optional(),
  })
    .min(1)
    .required(),
});

export const applyCartCouponValidation = Joi.object({
  body: Joi.object({
    code: Joi.string().trim().min(2).max(50).required(),
  }).required(),
});
