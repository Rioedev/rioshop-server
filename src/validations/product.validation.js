import Joi from "joi";

export const createProductSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(3)
    .max(200)
    .required()
    .messages({
      "string.empty": "Tên sản phẩm không được để trống",
      "string.min": "Tên sản phẩm phải có ít nhất 3 ký tự",
      "string.max": "Tên sản phẩm không được vượt quá 200 ký tự",
      "any.required": "Tên sản phẩm là bắt buộc"
    }),

  slug: Joi.string()
    .trim()
    .required()
    .messages({
      "string.empty": "Slug không được để trống",
      "any.required": "Slug là bắt buộc"
    }),

  brand: Joi.string()
    .trim()
    .allow("")
    .messages({
      "string.base": "Thương hiệu không hợp lệ"
    }),

  categoryIds: Joi.array()
    .items(Joi.string().hex().length(24))
    .messages({
      "string.length": "ID danh mục không hợp lệ",
      "string.hex": "ID danh mục không đúng định dạng"
    }),

  // ===== OPTIONS =====
  options: Joi.object({
    colors: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().required().messages({
            "string.empty": "Tên màu không được để trống",
            "any.required": "Tên màu là bắt buộc"
          }),

          code: Joi.string().required().messages({
            "string.empty": "Mã màu không được để trống",
            "any.required": "Mã màu là bắt buộc"
          }),

          images: Joi.array()
            .items(
              Joi.object({
                url: Joi.string().uri().required().messages({
                  "string.uri": "URL ảnh không hợp lệ",
                  "any.required": "Ảnh màu là bắt buộc"
                }),

                public_id: Joi.string().required().messages({
                  "any.required": "public_id của ảnh là bắt buộc"
                }),

                isThumbnail: Joi.boolean()
              })
            )
            .min(1)
            .required()
            .messages({
              "array.min": "Mỗi màu phải có ít nhất 1 ảnh",
              "any.required": "Danh sách ảnh màu là bắt buộc"
            })
        })
      )
      .min(1)
      .required()
      .messages({
        "array.min": "Sản phẩm phải có ít nhất 1 màu",
        "any.required": "Danh sách màu là bắt buộc"
      }),

    sizes: Joi.array()
      .items(Joi.string())
      .min(1)
      .messages({
        "array.min": "Phải có ít nhất 1 size"
      })
  }).required(),

  // ===== VARIANTS =====
  variants: Joi.array()
    .items(
      Joi.object({
        sku: Joi.string().trim().required().messages({
          "string.empty": "SKU không được để trống",
          "any.required": "SKU là bắt buộc"
        }),

        colorId: Joi.string().hex().length(24).required().messages({
          "string.length": "colorId không hợp lệ",
          "string.hex": "colorId không đúng định dạng",
          "any.required": "colorId là bắt buộc"
        }),

        size: Joi.string().required().messages({
          "string.empty": "Size không được để trống",
          "any.required": "Size là bắt buộc"
        }),

        price: Joi.number().min(0).required().messages({
          "number.base": "Giá bán phải là số",
          "number.min": "Giá bán không được nhỏ hơn 0",
          "any.required": "Giá bán là bắt buộc"
        }),

        originalPrice: Joi.number().min(0).messages({
          "number.base": "Giá gốc phải là số",
          "number.min": "Giá gốc không được nhỏ hơn 0"
        }),

        stock: Joi.number().integer().min(0).required().messages({
          "number.base": "Tồn kho phải là số",
          "number.min": "Tồn kho không được nhỏ hơn 0",
          "any.required": "Tồn kho là bắt buộc"
        }),

        reservedStock: Joi.number().integer().min(0).messages({
          "number.base": "reservedStock phải là số",
          "number.min": "reservedStock không được nhỏ hơn 0"
        }),

        status: Joi.string()
          .valid("available", "out_of_stock", "hidden")
          .messages({
            "any.only": "Trạng thái variant không hợp lệ"
          })
      })
    )
    .min(1)
    .required()
    .messages({
      "array.min": "Phải có ít nhất 1 biến thể sản phẩm",
      "any.required": "Danh sách biến thể là bắt buộc"
    }),

  // ===== SPECS =====
  specs: Joi.object({
    gender: Joi.string()
      .valid("male", "female", "unisex")
      .messages({
        "any.only": "Giới tính không hợp lệ"
      }),

    fit: Joi.string()
      .valid("slim", "regular", "oversize")
      .messages({
        "any.only": "Form sản phẩm không hợp lệ"
      }),

    materials: Joi.array().items(Joi.string()),

    seasons: Joi.array().items(Joi.string()),

    attributes: Joi.array().items(
      Joi.object({
        k: Joi.string().required().messages({
          "any.required": "Thuộc tính k là bắt buộc"
        }),
        v: Joi.string().required().messages({
          "any.required": "Thuộc tính v là bắt buộc"
        })
      })
    )
  }),

  // ===== SEO =====
  seo: Joi.object({
    title: Joi.string().allow(""),
    description: Joi.string().allow(""),
    keywords: Joi.array().items(Joi.string())
  }),

  status: Joi.string()
    .valid("draft", "review", "published", "archived")
    .messages({
      "any.only": "Trạng thái sản phẩm không hợp lệ"
    })
});