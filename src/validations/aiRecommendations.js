import Joi from "joi";

const objectIdValidation = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

export const recommendProductsValidation = Joi.object({
  body: Joi.object({
    message: Joi.string().trim().min(2).max(500).required(),
    limit: Joi.number().integer().min(1).max(8).optional(),
    context: Joi.object({
      categoryId: objectIdValidation.optional(),
      collectionId: objectIdValidation.optional(),
    })
      .optional()
      .default({}),
  }).required(),
});

export const aiShoppingChatValidation = Joi.object({
  body: Joi.object({
    message: Joi.string().trim().min(1).max(500).required(),
    history: Joi.array()
      .items(
        Joi.object({
          role: Joi.string().valid("user", "assistant").required(),
          content: Joi.string().trim().min(1).max(700).required(),
        }),
      )
      .max(12)
      .optional()
      .default([]),
    context: Joi.object({
      categoryId: objectIdValidation.optional(),
      collectionId: objectIdValidation.optional(),
      path: Joi.string().trim().max(160).optional(),
    })
      .optional()
      .default({}),
  }).required(),
});
