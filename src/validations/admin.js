import Joi from "joi";

/**
 * Validation schema for admin login
 */
export const adminLoginValidation = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Email must be valid",
      "any.required": "Email is required",
    }),
    password: Joi.string().required().messages({
      "any.required": "Password is required",
    }),
  }).required(),
});

/**
 * Validation schema for admin change password
 */
export const adminChangePasswordValidation = Joi.object({
  body: Joi.object({
    oldPassword: Joi.string().required().messages({
      "any.required": "Old password is required",
    }),
    newPassword: Joi.string().min(6).required().messages({
      "string.min": "New password must be at least 6 characters",
      "any.required": "New password is required",
    }),
    confirmPassword: Joi.string()
      .valid(Joi.ref("newPassword"))
      .required()
      .messages({
        "any.only": "Passwords do not match",
        "any.required": "Confirm password is required",
      }),
  }).required(),
});

/**
 * Validation schema for creating admin
 */
export const createAdminValidation = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Email must be valid",
      "any.required": "Email is required",
    }),
    password: Joi.string().min(6).required().messages({
      "string.min": "Password must be at least 6 characters",
      "any.required": "Password is required",
    }),
    fullName: Joi.string().min(2).max(100).required().messages({
      "string.min": "Full name must be at least 2 characters",
      "any.required": "Full name is required",
    }),
    role: Joi.string()
      .valid("superadmin", "manager", "warehouse", "cs", "marketer")
      .required()
      .messages({
        "any.only":
          "Role must be one of: superadmin, manager, warehouse, cs, marketer",
        "any.required": "Role is required",
      }),
    permissions: Joi.array().items(Joi.string()).optional(),
  }).required(),
});

/**
 * Validation schema for updating admin
 */
export const updateAdminValidation = Joi.object({
  body: Joi.object({
    fullName: Joi.string().min(2).max(100).optional(),
    role: Joi.string()
      .valid("superadmin", "manager", "warehouse", "cs", "marketer")
      .optional()
      .messages({
        "any.only":
          "Role must be one of: superadmin, manager, warehouse, cs, marketer",
      }),
    permissions: Joi.array().items(Joi.string()).optional(),
    isActive: Joi.boolean().optional(),
  })
    .min(1)
    .required()
    .messages({
      "object.min": "At least one field is required for update",
    }),
});
