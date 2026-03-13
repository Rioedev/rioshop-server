import Joi from "joi";

const mediaTypeValidation = Joi.string().valid("image", "video", "360");
const sizeValidation = Joi.string().valid("XS", "S", "M", "L", "XL", "2XL", "3XL");

const statusValidation = Joi.string().valid(
  "draft",
  "active",
  "archived",
  "out_of_stock",
);

const categoryValidation = Joi.object({
  _id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  name: Joi.string().trim().required(),
  slug: Joi.string().trim().allow("").optional(),
});

const inventorySummaryValidation = Joi.object({
  total: Joi.number().min(0),
  available: Joi.number().min(0),
  reserved: Joi.number().min(0),
});

const productMediaValidation = Joi.object({
  url: Joi.string().uri().required(),
  type: mediaTypeValidation.required(),
  altText: Joi.string().allow(""),
  colorRef: Joi.string().allow(""),
  isPrimary: Joi.boolean(),
  position: Joi.number().integer().min(0),
});

const productVariantValidation = Joi.object({
  variantId: Joi.string().trim().required(),
  sku: Joi.string().trim().required(),
  color: Joi.object({
    name: Joi.string().allow(""),
    hex: Joi.string().pattern(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).allow(""),
    imageUrl: Joi.string().uri().allow(""),
  }),
  size: sizeValidation.required(),
  sizeLabel: Joi.string().allow(""),
  additionalPrice: Joi.number().min(0),
  barcode: Joi.string().allow(""),
  images: Joi.array().items(Joi.string().uri()),
  isActive: Joi.boolean(),
  position: Joi.number().integer().min(0),
});

export const createProductValidation = Joi.object({
  body: Joi.object({
    sku: Joi.string().trim().required(),
    slug: Joi.string().trim().required(),
    name: Joi.string().trim().required(),
    brand: Joi.string().trim().required(),
    category: categoryValidation.required(),
    description: Joi.string().allow(""),
    shortDescription: Joi.string().allow(""),
    pricing: Joi.object({
      basePrice: Joi.number().required(),
      salePrice: Joi.number().required(),
    }).required(),
    inventorySummary: inventorySummaryValidation,
    variants: Joi.array().items(productVariantValidation).min(1).required(),
    media: Joi.array().items(productMediaValidation).min(1).required(),
    status: statusValidation,
    tags: Joi.array().items(Joi.string().trim()),
    gender: Joi.string().valid("men", "women", "unisex", "kids"),
    ageGroup: Joi.string().valid("adult", "teen", "kids", "baby"),
    material: Joi.array().items(Joi.string().trim()),
    care: Joi.array().items(Joi.string().trim()),
    seoMeta: Joi.object({
      title: Joi.string().allow(""),
      description: Joi.string().allow(""),
      keywords: Joi.array().items(Joi.string().trim()),
    }),
    isFeatured: Joi.boolean(),
    isNew: Joi.boolean(),
    isBestseller: Joi.boolean(),
  }).required(),
});

export const updateProductValidation = Joi.object({
  body: Joi.object({
    sku: Joi.string().trim(),
    slug: Joi.string().trim(),
    name: Joi.string().trim(),
    brand: Joi.string().trim(),
    description: Joi.string().allow(""),
    shortDescription: Joi.string().allow(""),
    category: categoryValidation,
    pricing: Joi.object({
      basePrice: Joi.number(),
      salePrice: Joi.number(),
    }),
    inventorySummary: inventorySummaryValidation,
    variants: Joi.array().items(productVariantValidation).min(1),
    media: Joi.array().items(productMediaValidation).min(1),
    status: statusValidation,
    tags: Joi.array().items(Joi.string().trim()),
    gender: Joi.string().valid("men", "women", "unisex", "kids"),
    ageGroup: Joi.string().valid("adult", "teen", "kids", "baby"),
    material: Joi.array().items(Joi.string().trim()),
    care: Joi.array().items(Joi.string().trim()),
    seoMeta: Joi.object({
      title: Joi.string().allow(""),
      description: Joi.string().allow(""),
      keywords: Joi.array().items(Joi.string().trim()),
    }),
    isFeatured: Joi.boolean(),
    isNew: Joi.boolean(),
    isBestseller: Joi.boolean(),
  })
    .min(1)
    .required(),
});

export const paginationValidation = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    category: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
    gender: Joi.string().valid("men", "women", "unisex", "kids").optional(),
    minPrice: Joi.number().min(0).optional(),
    maxPrice: Joi.number().min(0).optional(),
    sort: Joi.string().optional(),
    status: Joi.string().valid("all", "draft", "active", "archived", "out_of_stock").optional(),
  }),
});

export const searchProductsValidation = Joi.object({
  query: Joi.object({
    q: Joi.string().trim().min(1).required(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    status: Joi.string().valid("all", "draft", "active", "archived", "out_of_stock").optional(),
  }).required(),
});

export const productIdValidation = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  }).required(),
});

export const productSlugValidation = Joi.object({
  params: Joi.object({
    slug: Joi.string().trim().min(1).required(),
  }).required(),
});

export const relatedProductsValidation = Joi.object({
  params: Joi.object({
    id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  }).required(),
});
