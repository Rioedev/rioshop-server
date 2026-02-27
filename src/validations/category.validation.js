import Joi from "joi";

export const createCategorySchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      "string.empty": "Tên danh mục không được để trống",
      "string.min": "Tên danh mục phải có ít nhất 2 ký tự",
      "string.max": "Tên danh mục không được vượt quá 100 ký tự",
      "any.required": "Tên danh mục là bắt buộc"
    }),

  parentId: Joi.string()
    .hex()
    .length(24)
    .allow(null)
    .messages({
      "string.length": "parentId không hợp lệ",
      "string.hex": "parentId không đúng định dạng ObjectId"
    }),

  description: Joi.string()
    .max(500)
    .allow("")
    .messages({
      "string.max": "Mô tả không được vượt quá 500 ký tự"
    }),

  image: Joi.string()
    .uri()
    .allow("")
    .messages({
      "string.uri": "Ảnh danh mục phải là một URL hợp lệ"
    }),

  sortOrder: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .messages({
      "number.base": "Thứ tự sắp xếp phải là số",
      "number.integer": "Thứ tự sắp xếp phải là số nguyên",
      "number.min": "Thứ tự sắp xếp không được nhỏ hơn 0"
    }),

  status: Joi.string()
    .valid("active", "inactive")
    .default("active")
    .messages({
      "any.only": "Trạng thái danh mục không hợp lệ"
    })
});

export const updateCategorySchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      "string.empty": "Tên danh mục không được để trống",
      "string.min": "Tên danh mục phải có ít nhất 2 ký tự",
      "string.max": "Tên danh mục không được vượt quá 100 ký tự",
      "any.required": "Tên danh mục là bắt buộc"
    }),

  parentId: Joi.string()
    .hex()
    .length(24)
    .allow(null)
    .messages({
      "string.length": "parentId không hợp lệ",
      "string.hex": "parentId không đúng định dạng ObjectId"
    }),

  description: Joi.string()
    .max(500)
    .allow("")
    .messages({
      "string.max": "Mô tả không được vượt quá 500 ký tự"
    }),

  image: Joi.string()
    .uri()
    .allow("")
    .messages({
      "string.uri": "Ảnh danh mục phải là một URL hợp lệ"
    }),

  sortOrder: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .messages({
      "number.base": "Thứ tự sắp xếp phải là số",
      "number.integer": "Thứ tự sắp xếp phải là số nguyên",
      "number.min": "Thứ tự sắp xếp không được nhỏ hơn 0"
    }),

  status: Joi.string()
    .valid("active", "inactive")
    .default("active")
    .messages({
      "any.only": "Trạng thái danh mục không hợp lệ"
    })
});