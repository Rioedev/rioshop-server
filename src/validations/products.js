import Joi from "joi";

export const createProductValidation = Joi.object({
  body: Joi.object({
    sku: Joi.string().required(),
    slug: Joi.string().required(),
    name: Joi.string().required(),
    brand: Joi.string().required(),
    category: Joi.object().required(),
    pricing: Joi.object({
      basePrice: Joi.number().required(),
      salePrice: Joi.number().required(),
    }).required(),
    variants: Joi.array().required(),
    media: Joi.array().required(),
    status: Joi.string().valid("draft", "active", "archived", "out_of_stock"),
  }),
});

export const updateProductValidation = Joi.object({
  body: Joi.object({
    name: Joi.string(),
    brand: Joi.string(),
    description: Joi.string(),
    pricing: Joi.object({
      basePrice: Joi.number(),
      salePrice: Joi.number(),
    }),
    status: Joi.string().valid("draft", "active", "archived", "out_of_stock"),
  }),
});

export const paginationValidation = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
  }),
});
