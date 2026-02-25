import Joi from "joi";

export const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Tên danh mục không được để trống",
    "string.min": "Tên danh mục phải có ít nhất 2 ký tự",
    "string.max": "Tên danh mục không được vượt quá 100 ký tự",
    "any.required": "Tên danh mục là bắt buộc"
  }),

  parentId: Joi.string().hex().length(24).allow(null).messages({
    "string.length": "parentId không hợp lệ",
    "string.hex": "parentId không đúng định dạng"
  }),

  description: Joi.string().allow(""),

  status: Joi.string()
    .valid("active", "inactive")
    .messages({
      "any.only": "Trạng thái danh mục không hợp lệ"
    })
});