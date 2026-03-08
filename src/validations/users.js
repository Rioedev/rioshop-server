import Joi from "joi";

export const updateProfileValidation = Joi.object({
  body: Joi.object({
    fullName: Joi.string().min(2).max(100).optional(),
    avatar: Joi.string().uri().allow("", null).optional(),
    gender: Joi.string().valid("male", "female", "other").optional(),
    dateOfBirth: Joi.date().iso().allow(null).optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().pattern(/^[0-9]{10,11}$/).optional(),
    defaultAddressId: Joi.string().allow("", null).optional(),
    addresses: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().allow("", null).optional(),
          label: Joi.string().allow("", null).optional(),
          fullName: Joi.string().required(),
          phone: Joi.string().required(),
          province: Joi.object({
            code: Joi.string().allow("", null).optional(),
            name: Joi.string().allow("", null).optional(),
          }).optional(),
          district: Joi.object({
            code: Joi.string().allow("", null).optional(),
            name: Joi.string().allow("", null).optional(),
          }).optional(),
          ward: Joi.object({
            code: Joi.string().allow("", null).optional(),
            name: Joi.string().allow("", null).optional(),
          }).optional(),
          street: Joi.string().required(),
          isDefault: Joi.boolean().optional(),
        }),
      )
      .optional(),
    preferences: Joi.object({
      newsletter: Joi.boolean().optional(),
      smsAlert: Joi.boolean().optional(),
      favoriteCategories: Joi.array().items(Joi.string()).optional(),
    }).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
  })
    .min(1)
    .required(),
});

export const userListValidation = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }).required(),
});
