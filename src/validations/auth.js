import Joi from "joi";

/**
 * Validation schema for user registration
 */
export const registerValidation = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Email must be valid",
      "any.required": "Email is required",
    }),
    phone: Joi.string()
      .pattern(/^[0-9]{10,11}$/)
      .required()
      .messages({
        "string.pattern.base": "Phone must be 10-11 digits",
        "any.required": "Phone is required",
      }),
    password: Joi.string().min(6).required().messages({
      "string.min": "Password must be at least 6 characters",
      "any.required": "Password is required",
    }),
    confirmPassword: Joi.string()
      .valid(Joi.ref("password"))
      .required()
      .messages({
        "any.only": "Passwords do not match",
        "any.required": "Confirm password is required",
      }),
    fullName: Joi.string().min(2).max(100).required().messages({
      "string.min": "Full name must be at least 2 characters",
      "any.required": "Full name is required",
    }),
  }).required(),
});

/**
 * Validation schema for user login
 */
export const loginValidation = Joi.object({
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
 * Validation schema for change password
 */
export const changePasswordValidation = Joi.object({
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
 * Validation schema for forgot password
 */
export const forgotPasswordValidation = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Email must be valid",
      "any.required": "Email is required",
    }),
  }).required(),
});

/**
 * Validation schema for reset password
 */
export const resetPasswordValidation = Joi.object({
  body: Joi.object({
    userId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        "string.pattern.base": "Invalid user ID",
        "any.required": "User ID is required",
      }),
    resetToken: Joi.string().required().messages({
      "any.required": "Reset token is required",
    }),
    newPassword: Joi.string().min(6).required().messages({
      "string.min": "Password must be at least 6 characters",
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
