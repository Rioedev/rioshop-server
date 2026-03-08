import Joi from "joi";

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

export const getProductReviewsValidation = Joi.object({
  params: Joi.object({
    productId: objectId.required(),
  }).required(),
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    includePending: Joi.boolean().truthy("true").falsy("false").optional(),
    includeRejected: Joi.boolean().truthy("true").falsy("false").optional(),
  }).required(),
});

export const createReviewValidation = Joi.object({
  body: Joi.object({
    productId: objectId.required(),
    orderId: objectId.required(),
    variantSku: Joi.string().allow("", null).optional(),
    rating: Joi.number().integer().min(1).max(5).required(),
    title: Joi.string().allow("", null).optional(),
    body: Joi.string().min(1).required(),
    media: Joi.array().items(Joi.string().uri()).optional(),
    fit: Joi.string().valid("true_to_size", "runs_small", "runs_large").optional(),
    quality: Joi.number().integer().min(1).max(5).optional(),
  }).required(),
});

export const reviewIdValidation = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }).required(),
});

export const updateReviewValidation = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }).required(),
  body: Joi.object({
    rating: Joi.number().integer().min(1).max(5).optional(),
    title: Joi.string().allow("", null).optional(),
    body: Joi.string().min(1).optional(),
    media: Joi.array().items(Joi.string().uri()).optional(),
    fit: Joi.string().valid("true_to_size", "runs_small", "runs_large").optional(),
    quality: Joi.number().integer().min(1).max(5).optional(),
    status: Joi.string().valid("pending", "approved", "rejected").optional(),
    reported: Joi.boolean().optional(),
    adminReply: Joi.object({
      body: Joi.string().required(),
      repliedAt: Joi.date().iso().optional(),
      adminId: objectId.optional(),
    }).optional(),
  })
    .min(1)
    .required(),
});
