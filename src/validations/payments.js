import Joi from "joi";

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

export const createPaymentValidation = Joi.object({
  body: Joi.object({
    orderId: objectId.required(),
    method: Joi.string()
      .valid("momo", "vnpay", "zalopay", "cod", "bank_transfer", "card")
      .optional(),
    amount: Joi.number().min(1).optional(),
    currency: Joi.string().max(10).optional(),
    returnUrl: Joi.string().uri().optional(),
  }).required(),
});

export const paymentIdValidation = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }).required(),
});

export const paymentWebhookValidation = Joi.object({
  params: Joi.object({
    provider: Joi.string().valid("momo", "vnpay", "zalopay").required(),
  }).required(),
  body: Joi.object().unknown(true).required(),
});
