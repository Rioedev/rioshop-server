import Joi from "joi";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const userStatusValidation = Joi.string().valid("active", "banned", "inactive");
const phoneValidation = Joi.string().pattern(/^[0-9]{10,11}$/);

const addressValidation = Joi.object({
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
});

export const updateProfileValidation = Joi.object({
  body: Joi.object({
    fullName: Joi.string().min(2).max(100).optional(),
    avatar: Joi.string().uri().allow("", null).optional(),
    gender: Joi.string().valid("male", "female", "other").optional(),
    dateOfBirth: Joi.date().iso().allow(null).optional(),
    email: Joi.string().email().optional(),
    phone: phoneValidation.optional(),
    defaultAddressId: Joi.string().allow("", null).optional(),
    addresses: Joi.array().items(addressValidation).optional(),
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

export const customerIdValidation = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
  }).required(),
});

export const adminCustomerListValidation = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().trim().allow("").optional(),
    status: userStatusValidation.optional(),
    isDeleted: Joi.boolean().optional(),
  }).required(),
});

export const createCustomerByAdminValidation = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required(),
    phone: phoneValidation.required(),
    password: Joi.string().min(6).required(),
    fullName: Joi.string().min(2).max(100).required(),
    avatar: Joi.string().uri().allow("", null).optional(),
    gender: Joi.string().valid("male", "female", "other").optional(),
    dateOfBirth: Joi.date().iso().allow(null).optional(),
    defaultAddressId: Joi.string().allow("", null).optional(),
    addresses: Joi.array().items(addressValidation).optional(),
    preferences: Joi.object({
      newsletter: Joi.boolean().optional(),
      smsAlert: Joi.boolean().optional(),
      favoriteCategories: Joi.array().items(Joi.string()).optional(),
    }).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    status: userStatusValidation.optional(),
  }).required(),
});

export const updateCustomerByAdminValidation = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
  }).required(),
  body: Joi.object({
    email: Joi.string().email().optional(),
    phone: phoneValidation.optional(),
    fullName: Joi.string().min(2).max(100).optional(),
    avatar: Joi.string().uri().allow("", null).optional(),
    gender: Joi.string().valid("male", "female", "other").optional(),
    dateOfBirth: Joi.date().iso().allow(null).optional(),
    defaultAddressId: Joi.string().allow("", null).optional(),
    addresses: Joi.array().items(addressValidation).optional(),
    preferences: Joi.object({
      newsletter: Joi.boolean().optional(),
      smsAlert: Joi.boolean().optional(),
      favoriteCategories: Joi.array().items(Joi.string()).optional(),
    }).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    status: userStatusValidation.optional(),
  })
    .min(1)
    .required(),
});

export const updateCustomerStatusByAdminValidation = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(objectIdPattern).required(),
  }).required(),
  body: Joi.object({
    status: userStatusValidation.required(),
  }).required(),
});
