import Joi from "joi";

const objectIdValidation = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const seoMetaValidation = Joi.object({
  title: Joi.string().allow("").max(160).optional(),
  description: Joi.string().allow("").max(320).optional(),
  keywords: Joi.array().items(Joi.string().trim()).optional(),
});

export const createCollectionValidation = Joi.object({
  body: Joi.object({
    name: Joi.string().trim().required().min(2).max(120),
    description: Joi.string().trim().allow("").max(1000).optional(),
    image: Joi.string().uri().allow("", null).optional(),
    bannerImage: Joi.string().uri().allow("", null).optional(),
    position: Joi.number().integer().min(0).optional().default(0),
    isActive: Joi.boolean().optional().default(true),
    startsAt: Joi.date().iso().allow(null).optional(),
    endsAt: Joi.date().iso().allow(null).optional(),
    seoMeta: seoMetaValidation.optional(),
  }).required(),
});

export const updateCollectionValidation = Joi.object({
  body: Joi.object({
    name: Joi.string().trim().min(2).max(120).optional(),
    description: Joi.string().trim().allow("").max(1000).optional(),
    image: Joi.string().uri().allow("", null).optional(),
    bannerImage: Joi.string().uri().allow("", null).optional(),
    position: Joi.number().integer().min(0).optional(),
    isActive: Joi.boolean().optional(),
    startsAt: Joi.date().iso().allow(null).optional(),
    endsAt: Joi.date().iso().allow(null).optional(),
    seoMeta: seoMetaValidation.optional(),
  })
    .min(1)
    .required(),
});

export const collectionPaginationValidation = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    isActive: Joi.boolean().optional(),
  }).required(),
});

export const searchCollectionValidation = Joi.object({
  query: Joi.object({
    q: Joi.string().trim().required().min(1).max(120),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    isActive: Joi.boolean().optional(),
  }).required(),
});

export const getCollectionByIdValidation = Joi.object({
  params: Joi.object({
    id: objectIdValidation.required(),
  }).required(),
});

export const deleteCollectionValidation = Joi.object({
  params: Joi.object({
    id: objectIdValidation.required(),
  }).required(),
});
