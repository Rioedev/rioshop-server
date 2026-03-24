import Joi from "joi";

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

export const shipmentIdValidation = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }).required(),
});

export const ghnDistrictsValidation = Joi.object({
  query: Joi.object({
    provinceId: Joi.number().integer().positive().required(),
  }).required(),
});

export const ghnWardsValidation = Joi.object({
  query: Joi.object({
    districtId: Joi.number().integer().positive().required(),
  }).required(),
});

export const ghnFeeValidation = Joi.object({
  body: Joi.object({
    toDistrictId: Joi.number().integer().positive().required(),
    toWardCode: Joi.string().trim().required(),
    shippingMethod: Joi.string().valid("standard", "express", "same_day").optional(),
    insuranceValue: Joi.number().min(0).optional(),
    codAmount: Joi.number().min(0).optional(),
    packageProfile: Joi.object({
      weight: Joi.number().min(1).optional(),
      length: Joi.number().min(1).optional(),
      width: Joi.number().min(1).optional(),
      height: Joi.number().min(1).optional(),
    })
      .unknown(false)
      .optional(),
    weight: Joi.number().min(1).optional(),
    length: Joi.number().min(1).optional(),
    width: Joi.number().min(1).optional(),
    height: Joi.number().min(1).optional(),
  })
    .min(2)
    .required(),
});

export const updateTrackingValidation = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }).required(),
  body: Joi.object({
    status: Joi.string()
      .valid(
        "ready",
        "picked_up",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "failed",
        "returned",
      )
      .optional(),
    trackingCode: Joi.string().trim().optional(),
    trackingUrl: Joi.string().uri().allow("", null).optional(),
    estimatedDelivery: Joi.date().iso().allow(null).optional(),
    shippingAddress: Joi.object().unknown(true).optional(),
    recipientName: Joi.string().trim().optional(),
    recipientPhone: Joi.string().trim().optional(),
    weight: Joi.number().min(0).optional(),
    codAmount: Joi.number().min(0).optional(),
    location: Joi.string().allow("", null).optional(),
    note: Joi.string().allow("", null).optional(),
    eventAt: Joi.date().iso().optional(),
  })
    .min(1)
    .required(),
});

export const shipmentWebhookValidation = Joi.object({
  params: Joi.object({
    carrier: Joi.string().trim().min(2).required(),
  }).required(),
  body: Joi.object().unknown(true).required(),
});
