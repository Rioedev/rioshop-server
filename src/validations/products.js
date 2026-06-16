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

const sizeChartValidation = Joi.object({
  unit: Joi.string().trim().valid("cm").default("cm"),
  rows: Joi.array()
    .items(
      Joi.object({
        size: Joi.string().trim().required(),
        shoulder: Joi.number().min(0).allow(null),
        chest: Joi.number().min(0).allow(null),
        waist: Joi.number().min(0).allow(null),
        hip: Joi.number().min(0).allow(null),
        length: Joi.number().min(0).allow(null),
      }),
    )
    .max(40)
    .default([]),
});

const resolveRegularPrice = (value = {}) => value.regularPrice ?? value.salePrice;
const resolveCompareAtPrice = (value = {}) => value.compareAtPrice ?? value.basePrice;

// regularPrice là giá bán thường ngày. compareAtPrice là giá tham chiếu/niêm yết
// để so sánh khi có giảm giá. salePrice/basePrice chỉ là alias legacy.
const createPricingValidation = Joi.object({
  regularPrice: Joi.number().min(0).optional(),
  compareAtPrice: Joi.number().min(0).optional(),
  basePrice: Joi.number().min(0).optional(),
  salePrice: Joi.number().min(0).optional(),
})
  .custom((value, helpers) => {
    const regular = Number(resolveRegularPrice(value));
    if (!Number.isFinite(regular)) {
      return helpers.error("any.required");
    }

    const compareAt = Number(resolveCompareAtPrice(value));
    if (Number.isFinite(compareAt) && compareAt > 0 && compareAt < regular) {
      return helpers.error("any.invalid");
    }
    return value;
  })
  .messages({
    "any.required": "Giá bán thường ngày là bắt buộc",
    "any.invalid": "Giá tham chiếu phải lớn hơn hoặc bằng giá bán thường ngày",
  });

const updatePricingValidation = Joi.object({
  regularPrice: Joi.number().min(0),
  compareAtPrice: Joi.number().min(0),
  basePrice: Joi.number().min(0),
  salePrice: Joi.number().min(0),
})
  .custom((value, helpers) => {
    const regularRaw = resolveRegularPrice(value);
    const compareAtRaw = resolveCompareAtPrice(value);
    if (regularRaw === undefined || compareAtRaw === undefined) {
      return value;
    }

    const regular = Number(regularRaw);
    const compareAt = Number(compareAtRaw);
    if (Number.isFinite(compareAt) && compareAt > 0 && Number.isFinite(regular) && compareAt < regular) {
      return helpers.error("any.invalid");
    }
    return value;
  })
  .messages({
    "any.invalid": "Giá tham chiếu phải lớn hơn hoặc bằng giá bán thường ngày",
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
    sizeChart: sizeChartValidation.optional(),
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
    sizeChart: sizeChartValidation,
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
    ranking: Joi.string().valid("best_selling").optional(),
    newWithinDays: Joi.number().integer().min(1).max(365).optional(),
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

export const cartRecommendationsValidation = Joi.object({
  body: Joi.object({
    productIds: Joi.array()
      .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
      .min(1)
      .max(30)
      .required(),
    limit: Joi.number().integer().min(1).max(12).default(4),
  }).required(),
});
