import Joi from "joi";

const mediaTypeValidation = Joi.string().valid("image", "video", "360");
const sizeValidation = Joi.string().trim().min(1);

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

const collectionValidation = Joi.object({
  _id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  name: Joi.string().trim().required(),
  slug: Joi.string().trim().allow("").optional(),
  image: Joi.string().uri().allow("").optional(),
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
  sku: Joi.string().trim().allow("").optional(),
  color: Joi.object({
    name: Joi.string().allow(""),
    hex: Joi.string().pattern(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).allow(""),
    imageUrl: Joi.string().uri().allow(""),
  }),
  size: sizeValidation.required(),
  sizeLabel: Joi.string().allow(""),
  stock: Joi.number().min(0),
  additionalPrice: Joi.number().min(0),
  barcode: Joi.string().allow(""),
  images: Joi.array().items(Joi.string().uri()),
  isActive: Joi.boolean(),
  position: Joi.number().integer().min(0),
});

const createPricingValidation = Joi.object({
  basePrice: Joi.number().min(0).required(),
  salePrice: Joi.number().min(0).max(Joi.ref("basePrice")).required().messages({
    "number.max": "salePrice must be less than or equal to basePrice",
  }),
});

const updatePricingValidation = Joi.object({
  basePrice: Joi.number().min(0),
  salePrice: Joi.number().min(0),
})
  .custom((value, helpers) => {
    if (
      value.basePrice !== undefined &&
      value.salePrice !== undefined &&
      value.salePrice > value.basePrice
    ) {
      return helpers.error("any.invalid");
    }
    return value;
  })
  .messages({
    "any.invalid": "salePrice must be less than or equal to basePrice",
  });

export const createProductValidation = Joi.object({
  body: Joi.object({
    sku: Joi.string().trim().allow("").optional(),
    slug: Joi.string().trim().required(),
    name: Joi.string().trim().required(),
    brand: Joi.string().trim().required(),
    category: categoryValidation.required(),
    collections: Joi.array().items(collectionValidation).max(50).optional(),
    description: Joi.string().allow(""),
    shortDescription: Joi.string().allow(""),
    pricing: createPricingValidation.required(),
    inventorySummary: inventorySummaryValidation,
    variants: Joi.array().items(productVariantValidation).min(1).required(),
    media: Joi.array().items(productMediaValidation).optional(),
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
    sku: Joi.string().trim().allow(""),
    slug: Joi.string().trim(),
    name: Joi.string().trim(),
    brand: Joi.string().trim(),
    description: Joi.string().allow(""),
    shortDescription: Joi.string().allow(""),
    category: categoryValidation,
    collections: Joi.array().items(collectionValidation).max(50),
    pricing: updatePricingValidation,
    inventorySummary: inventorySummaryValidation,
    variants: Joi.array().items(productVariantValidation).min(1),
    media: Joi.array().items(productMediaValidation),
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
    q: Joi.string().trim().max(200).optional(),
    category: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
    collection: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
    gender: Joi.string().valid("men", "women", "unisex", "kids").optional(),
    minPrice: Joi.number().min(0).optional(),
    maxPrice: Joi.number().min(0).optional(),
    color: Joi.string().trim().max(240).optional(),
    size: Joi.string().trim().max(240).optional(),
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
