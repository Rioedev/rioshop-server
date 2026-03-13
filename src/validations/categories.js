import Joi from "joi";

/**
 * Validation schema for creating a new category
 */
export const createCategoryValidation = Joi.object({
  body: Joi.object({
    name: Joi.string().trim().required().min(2).max(100).messages({
      "string.empty": "Category name is required",
      "string.min": "Category name must be at least 2 characters",
      "string.max": "Category name must not exceed 100 characters",
    }),
    description: Joi.string().trim().max(500).optional().messages({
      "string.max": "Description must not exceed 500 characters",
    }),
    parentId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .allow(null)
      .messages({
        "string.pattern.base": "Invalid parent category ID",
      }),
    image: Joi.string().uri().optional().allow(null, "").messages({
      "string.uri": "Image must be a valid URL",
    }),
    icon: Joi.string().optional().allow(null, "").messages({
      "string.empty": "Icon value must not be empty if provided",
    }),
    position: Joi.number().integer().min(0).optional().default(0).messages({
      "number.base": "Position must be a number",
      "number.min": "Position must be greater than or equal to 0",
    }),
    seoMeta: Joi.object({
      title: Joi.string().max(60).optional(),
      description: Joi.string().max(160).optional(),
      keywords: Joi.array().items(Joi.string()).optional(),
    }).optional(),
  }).required(),
});

/**
 * Validation schema for updating a category
 */
export const updateCategoryValidation = Joi.object({
  body: Joi.object({
    name: Joi.string().trim().min(2).max(100).optional().messages({
      "string.min": "Category name must be at least 2 characters",
      "string.max": "Category name must not exceed 100 characters",
    }),
    description: Joi.string().trim().max(500).optional().messages({
      "string.max": "Description must not exceed 500 characters",
    }),
    parentId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .allow(null)
      .messages({
        "string.pattern.base": "Invalid parent category ID",
      }),
    image: Joi.string().uri().optional().allow(null, "").messages({
      "string.uri": "Image must be a valid URL",
    }),
    icon: Joi.string().optional().allow(null, "").messages({
      "string.empty": "Icon value must not be empty if provided",
    }),
    position: Joi.number().integer().min(0).optional().messages({
      "number.base": "Position must be a number",
      "number.min": "Position must be greater than or equal to 0",
    }),
    isActive: Joi.boolean().optional(),
    seoMeta: Joi.object({
      title: Joi.string().max(60).optional(),
      description: Joi.string().max(160).optional(),
      keywords: Joi.array().items(Joi.string()).optional(),
    }).optional(),
  })
    .min(1)
    .required()
    .messages({
      "object.min": "At least one field is required for update",
    }),
});

/**
 * Validation schema for search query
 */
export const searchCategoryValidation = Joi.object({
  query: Joi.object({
    q: Joi.string().trim().required().min(1).max(100).messages({
      "string.empty": "Search query is required",
      "string.max": "Search query must not exceed 100 characters",
    }),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    isActive: Joi.boolean().optional(),
  }).required(),
});

/**
 * Validation schema for pagination
 */
export const paginationValidation = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    parentId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .messages({
        "string.pattern.base": "Invalid parent category ID",
      }),
    level: Joi.number().integer().min(0).optional().messages({
      "number.base": "Level must be a number",
    }),
    isActive: Joi.boolean().optional(),
  }).required(),
});

/**
 * Validation schema for getting subcategories
 */
export const getSubcategoriesValidation = Joi.object({
  params: Joi.object({
    id: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        "string.pattern.base": "Invalid category ID",
      }),
  }).required(),
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(100).optional(),
  }).optional(),
});

/**
 * Validation schema for getting category by ID
 */
export const getCategoryByIdValidation = Joi.object({
  params: Joi.object({
    id: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        "string.pattern.base": "Invalid category ID",
      }),
  }).required(),
});

/**
 * Validation schema for deleting a category
 */
export const deleteCategoryValidation = Joi.object({
  params: Joi.object({
    id: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        "string.pattern.base": "Invalid category ID",
      }),
  }).required(),
});
