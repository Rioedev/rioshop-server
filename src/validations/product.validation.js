import Joi from "joi";

export const createProductSchema = Joi.object({
  name: Joi.string().trim().min(3).max(200).required().messages({
    "string.empty": "Tên sản phẩm không được để trống",
    "string.min": "Tên sản phẩm phải có ít nhất 3 ký tự",
    "string.max": "Tên sản phẩm không được vượt quá 200 ký tự",
    "any.required": "Tên sản phẩm là bắt buộc",
  }),

  slug: Joi.string().trim().optional().allow("").messages({
    "string.base": "Slug phải là chuỗi",
  }),

  brand: Joi.string().trim().allow("").messages({
    "string.base": "Thương hiệu không hợp lệ",
  }),

  categoryIds: Joi.array()
    .items(Joi.string().hex().length(24))
    .optional()
    .messages({
      "string.length": "ID danh mục không hợp lệ",
      "string.hex": "ID danh mục không đúng định dạng",
    }),

  description: Joi.string().optional().allow("").messages({
    "string.base": "Mô tả phải là chuỗi",
  }),

  // ===== OPTIONS =====
  options: Joi.object({
    colors: Joi.array()
      .items(
        Joi.object({
          _id: Joi.string().optional(),

          name: Joi.string().trim().required().messages({
            "string.empty": "Tên màu không được để trống",
            "any.required": "Tên màu là bắt buộc",
          }),

          code: Joi.string().trim().required().messages({
            "string.empty": "Mã màu không được để trống",
            "any.required": "Mã màu là bắt buộc",
          }),

          // images có thể là URL string hoặc object với url/public_id
          images: Joi.array()
            .items(
              Joi.alternatives().try(
                Joi.object({
                  url: Joi.string().uri().required(),
                  public_id: Joi.string().required(),
                  isThumbnail: Joi.boolean().default(false),
                }),
                Joi.string(), // file path hoặc base64
              ),
            )
            .min(1)
            .required()
            .messages({
              "array.min": "Mỗi màu phải có ít nhất 1 ảnh",
              "any.required": "Danh sách ảnh màu là bắt buộc",
            }),
        }),
      )
      .min(1)
      .required()
      .messages({
        "array.min": "Sản phẩm phải có ít nhất 1 màu",
        "any.required": "Danh sách màu là bắt buộc",
      }),

    sizes: Joi.array().items(Joi.string().trim()).min(1).messages({
      "array.min": "Phải có ít nhất 1 size",
    }),
  }).optional(),

  // ===== VARIANTS =====
  variants: Joi.array()
    .items(
      Joi.object({
        _id: Joi.string().optional(),

        sku: Joi.string().trim().required().messages({
          "string.empty": "SKU không được để trống",
          "any.required": "SKU là bắt buộc",
        }),

        colorId: Joi.string().trim().required().messages({
          "string.empty": "colorId không được để trống",
          "any.required": "colorId là bắt buộc",
        }),

        size: Joi.string().trim().required().messages({
          "string.empty": "Size không được để trống",
          "any.required": "Size là bắt buộc",
        }),

        price: Joi.number().positive().required().messages({
          "number.base": "Giá bán phải là số",
          "number.positive": "Giá bán phải lớn hơn 0",
          "any.required": "Giá bán là bắt buộc",
        }),

        originalPrice: Joi.number().positive().optional().messages({
          "number.base": "Giá gốc phải là số",
          "number.positive": "Giá gốc phải lớn hơn 0",
        }),

        stock: Joi.number().integer().min(0).default(0).messages({
          "number.base": "Tồn kho phải là số",
          "number.min": "Tồn kho không được nhỏ hơn 0",
        }),

        reservedStock: Joi.number().integer().min(0).optional().messages({
          "number.base": "reservedStock phải là số",
          "number.min": "reservedStock không được nhỏ hơn 0",
        }),

        status: Joi.string()
          .valid("available", "out_of_stock", "hidden")
          .default("available")
          .messages({
            "any.only": "Trạng thái variant không hợp lệ",
          }),
      }),
    )
    .min(1)
    .optional()
    .messages({
      "array.min": "Phải có ít nhất 1 biến thể sản phẩm",
    }),

  // ===== SPECS =====
  specs: Joi.object({
    gender: Joi.string().valid("male", "female", "unisex").optional().messages({
      "any.only": "Giới tính không hợp lệ",
    }),

    fit: Joi.string().valid("slim", "regular", "oversize").optional().messages({
      "any.only": "Form sản phẩm không hợp lệ",
    }),

    materials: Joi.array().items(Joi.string().trim()).optional(),

    seasons: Joi.array().items(Joi.string().trim()).optional(),

    attributes: Joi.array()
      .items(
        Joi.object({
          k: Joi.string().trim().required().messages({
            "any.required": "Thuộc tính k là bắt buộc",
          }),
          v: Joi.string().trim().required().messages({
            "any.required": "Thuộc tính v là bắt buộc",
          }),
        }),
      )
      .optional(),
  }).optional(),

  // ===== SEO =====
  seo: Joi.object({
    title: Joi.string().trim().allow("").optional(),
    description: Joi.string().trim().allow("").optional(),
    keywords: Joi.array().items(Joi.string().trim()).optional(),
  }).optional(),

  status: Joi.string()
    .valid("draft", "review", "published", "archived")
    .default("draft")
    .messages({
      "any.only": "Trạng thái sản phẩm không hợp lệ",
    }),
}).unknown(true); // allow unknown fields like file paths

export const updateProductSchema = Joi.object().unknown(true); // Update accepts any payload
