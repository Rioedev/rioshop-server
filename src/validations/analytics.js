import Joi from "joi";

export const analyticsEventsValidation = Joi.object({
  query: Joi.object({
    event: Joi.string()
      .valid("page_view", "product_view", "add_to_cart", "purchase", "search", "click")
      .optional(),
    userId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
    sessionId: Joi.string().max(255).optional(),
    productId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
    orderId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }).required(),
});

export const analyticsTrackValidation = Joi.object({
  body: Joi.object({
    event: Joi.string()
      .valid("page_view", "product_view", "add_to_cart", "purchase", "search", "click")
      .required(),
    userId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
    sessionId: Joi.string().max(255).required(),
    productId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
    orderId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
    properties: Joi.object().unknown(true).optional(),
    device: Joi.object().unknown(true).optional(),
    utm: Joi.object().unknown(true).optional(),
  }).required(),
});

export const analyticsDashboardValidation = Joi.object({
  query: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
  }).required(),
});
