import Joi from "joi";

export const listBlogsValidation = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    q: Joi.string().trim().max(200).optional(),
    tag: Joi.string().trim().max(100).optional(),
    featured: Joi.boolean().optional(),
    isPublished: Joi.boolean().optional(),
  }).required(),
});

export const createBlogValidation = Joi.object({
  body: Joi.object({
    title: Joi.string().trim().min(3).max(220).required(),
    slug: Joi.string().trim().min(3).max(260).optional(),
    excerpt: Joi.string().trim().allow("").max(600).optional(),
    content: Joi.string().trim().allow("").optional(),
    coverImage: Joi.string().uri().allow("").optional(),
    tags: Joi.array().items(Joi.string().trim().max(60)).optional(),
    authorName: Joi.string().trim().max(120).optional(),
    isPublished: Joi.boolean().optional(),
    isFeatured: Joi.boolean().optional(),
    publishedAt: Joi.date().optional(),
  }).required(),
});

export const updateBlogValidation = Joi.object({
  params: Joi.object({
    id: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        "string.pattern.base": "Invalid blog ID",
      }),
  }).required(),
  body: Joi.object({
    title: Joi.string().trim().min(3).max(220).optional(),
    slug: Joi.string().trim().min(3).max(260).optional(),
    excerpt: Joi.string().trim().allow("").max(600).optional(),
    content: Joi.string().trim().allow("").optional(),
    coverImage: Joi.string().uri().allow("").optional(),
    tags: Joi.array().items(Joi.string().trim().max(60)).optional(),
    authorName: Joi.string().trim().max(120).optional(),
    isPublished: Joi.boolean().optional(),
    isFeatured: Joi.boolean().optional(),
    publishedAt: Joi.date().allow(null).optional(),
  }).min(1).required(),
});

export const deleteBlogValidation = Joi.object({
  params: Joi.object({
    id: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        "string.pattern.base": "Invalid blog ID",
      }),
  }).required(),
});
