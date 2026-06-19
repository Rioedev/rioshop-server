import Joi from "joi";

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

export const getOrdersValidation = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    status: Joi.string()
      .valid(
        "pending",
        "confirmed",
        "packing",
        "ready_to_ship",
        "shipping",
        "delivered",
        "completed",
        "cancelled",
        "returned",
      )
      .optional(),
    paymentStatus: Joi.string().valid("pending", "paid", "refunded", "failed").optional(),
  }).required(),
});

export const orderIdValidation = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }).required(),
});

export const createOrderValidation = Joi.object({
  body: Joi.object({
    orderNumber: Joi.string().trim().optional(),
    customerSnapshot: Joi.object({
      name: Joi.string().trim().required(),
      email: Joi.string().email().allow("", null).optional(),
      phone: Joi.string().allow("", null).optional(),
    }).optional(),
    items: Joi.array()
      .items(
        Joi.object({
          productId: objectId.required(),
          variantSku: Joi.string().trim().required(),
          productName: Joi.string().trim().required(),
          variantLabel: Joi.string().trim().allow("").optional(),
          image: Joi.string().uri().required(),
          unitPrice: Joi.number().min(0).required(),
          quantity: Joi.number().integer().min(1).required(),
          totalPrice: Joi.number().min(0).optional(),
          returnedQty: Joi.number().integer().min(0).optional(),
        }),
      )
      .min(1)
      .required(),
    shippingAddress: Joi.object({
      line1: Joi.string().trim().required(),
      wardCode: Joi.string().trim().allow("").optional(),
      wardName: Joi.string().trim().allow("").optional(),
      districtId: Joi.number().integer().min(0).optional(),
      districtName: Joi.string().trim().allow("").optional(),
      provinceId: Joi.number().integer().min(0).optional(),
      provinceName: Joi.string().trim().allow("").optional(),
      city: Joi.string().trim().allow("").optional(),
      country: Joi.string().trim().allow("").optional(),
    }).required(),
    shippingFee: Joi.number().min(0).optional(),
    pricing: Joi.object({
      shippingFee: Joi.number().min(0).optional(),
      currency: Joi.string().max(10).optional(),
    }).optional(),
    couponCode: Joi.string().trim().allow("", null).optional(),
    couponDiscount: Joi.number().min(0).optional(),
    loyaltyPointsUsed: Joi.number().integer().min(0).optional(),
    loyaltyPointsEarned: Joi.number().integer().min(0).optional(),
    paymentMethod: Joi.string()
      .valid("cod", "bank_transfer", "momo", "vnpay", "zalopay", "card")
      .required(),
    paymentStatus: Joi.string().valid("pending", "paid", "refunded", "failed").optional(),
    shippingMethod: Joi.string().valid("standard", "express", "same_day").required(),
    shippingCarrier: Joi.string().allow("", null).optional(),
    status: Joi.string()
      .valid(
        "pending",
        "confirmed",
        "packing",
        "ready_to_ship",
        "shipping",
        "delivered",
        "completed",
        "cancelled",
        "returned",
      )
      .optional(),
    note: Joi.string().allow("", null).optional(),
    adminNote: Joi.string().allow("", null).optional(),
    source: Joi.string().valid("web", "mobile", "pos", "admin").optional(),
  }).required(),
});

export const updateOrderStatusValidation = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }).required(),
  body: Joi.object({
    status: Joi.string()
      .valid(
        "pending",
        "confirmed",
        "packing",
        "ready_to_ship",
        "shipping",
        "delivered",
        "completed",
        "cancelled",
        "returned",
      )
      .required(),
    note: Joi.string().allow("", null).optional(),
    paymentStatus: Joi.string().valid("pending", "paid", "refunded", "failed").optional(),
  }).required(),
});

export const cancelOrderValidation = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }).required(),
  body: Joi.object({
    note: Joi.string().allow("", null).optional(),
  }).optional(),
});

export const submitReturnRequestValidation = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }).required(),
  body: Joi.object({
    type: Joi.string().valid("exchange").required(),
    reason: Joi.string().trim().min(5).max(500).required(),
    note: Joi.string().trim().allow("", null).max(1000).optional(),
    images: Joi.array().items(Joi.string().uri()).max(8).optional(),
    items: Joi.array()
      .items(
        Joi.object({
          productId: objectId.required(),
          originalVariantSku: Joi.string().trim().required(),
          replacementVariantSku: Joi.string().trim().required(),
          quantity: Joi.number().integer().min(1).required(),
        }),
      )
      .min(1)
      .required(),
  }).required(),
});

export const updateReturnRequestStatusValidation = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }).required(),
  body: Joi.object({
    status: Joi.string().valid("pending", "approved", "rejected", "completed").required(),
    note: Joi.string().trim().allow("", null).max(1000).optional(),
    exchangeItems: Joi.array()
      .items(
        Joi.object({
          productId: objectId.required(),
          originalVariantSku: Joi.string().trim().required(),
          replacementVariantSku: Joi.string().trim().required(),
          quantity: Joi.number().integer().min(1).required(),
          returnDisposition: Joi.string().valid("restock", "quarantine").required(),
        }),
      )
      .min(1)
      .when("status", {
        is: "completed",
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
  }).required(),
});
