const FIELD_LABELS = {
  id: "Mã định danh",
  userId: "Mã người dùng",
  adminId: "Mã quản trị viên",
  email: "Email",
  phone: "Số điện thoại",
  password: "Mật khẩu",
  oldPassword: "Mật khẩu hiện tại",
  newPassword: "Mật khẩu mới",
  confirmPassword: "Xác nhận mật khẩu",
  fullName: "Họ tên",
  role: "Vai trò",
  title: "Tiêu đề",
  name: "Tên",
  slug: "Đường dẫn",
  code: "Mã",
  status: "Trạng thái",
  image: "Ảnh",
  productId: "Mã sản phẩm",
  categoryId: "Mã danh mục",
  collectionId: "Mã bộ sưu tập",
  variantSku: "SKU biến thể",
  salePrice: "Giá bán",
  basePrice: "Giá gốc",
};

const normalizeFieldName = (value = "") =>
  value
    .toString()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();

const toFieldLabel = (path = []) => {
  const normalizedPath = (Array.isArray(path) ? path : [])
    .map((segment) => segment?.toString?.() ?? "")
    .filter(Boolean)
    .filter((segment) => !["body", "query", "params"].includes(segment));

  const fieldKey = normalizedPath[normalizedPath.length - 1] || "";
  if (!fieldKey) {
    return "Trường dữ liệu";
  }

  if (FIELD_LABELS[fieldKey]) {
    return FIELD_LABELS[fieldKey];
  }

  const fallback = normalizeFieldName(fieldKey);
  if (!fallback) {
    return "Trường dữ liệu";
  }

  return fallback.charAt(0).toUpperCase() + fallback.slice(1);
};

const localizeEnglishValidationMessage = (rawMessage = "", fieldLabel = "Trường dữ liệu") => {
  const normalized = rawMessage.toString().trim();
  if (!normalized) {
    return "";
  }

  const messageKey = normalized.toLowerCase();
  const exactMap = {
    "email must be valid": "Email không đúng định dạng.",
    "email is required": "Email là bắt buộc.",
    "phone must be 10-11 digits": "Số điện thoại phải gồm 10-11 chữ số.",
    "phone is required": "Số điện thoại là bắt buộc.",
    "password is required": "Mật khẩu là bắt buộc.",
    "passwords do not match": "Mật khẩu xác nhận không khớp.",
    "confirm password is required": "Xác nhận mật khẩu là bắt buộc.",
    "old password is required": "Mật khẩu hiện tại là bắt buộc.",
    "new password is required": "Mật khẩu mới là bắt buộc.",
    "new password must be at least 6 characters": "Mật khẩu mới phải có ít nhất 6 ký tự.",
    "password must be at least 6 characters": "Mật khẩu phải có ít nhất 6 ký tự.",
    "full name is required": "Họ tên là bắt buộc.",
    "full name must be at least 2 characters": "Họ tên phải có ít nhất 2 ký tự.",
    "invalid user id": "Mã người dùng không hợp lệ.",
    "user id is required": "Mã người dùng là bắt buộc.",
    "reset token is required": "Mã đặt lại mật khẩu là bắt buộc.",
    "invalid blog id": "Mã bài viết không hợp lệ.",
    "validation failed": "Dữ liệu gửi lên chưa hợp lệ.",
  };

  if (exactMap[messageKey]) {
    return exactMap[messageKey];
  }

  if (/role must be one of:/i.test(normalized)) {
    return "Vai trò không hợp lệ.";
  }
  if (/at least one field is required/i.test(normalized)) {
    return "Cần cung cấp ít nhất một trường dữ liệu để cập nhật.";
  }
  if (/saleprice must be less than or equal to baseprice/i.test(normalized)) {
    return "Giá bán phải nhỏ hơn hoặc bằng giá gốc.";
  }
  if (/search query is required/i.test(normalized)) {
    return "Từ khóa tìm kiếm là bắt buộc.";
  }
  if (/search query must not exceed/i.test(normalized)) {
    return "Từ khóa tìm kiếm vượt quá độ dài cho phép.";
  }
  if (/category name is required/i.test(normalized)) {
    return "Tên danh mục là bắt buộc.";
  }
  if (/category name must be at least/i.test(normalized)) {
    return "Tên danh mục quá ngắn.";
  }
  if (/category name must not exceed/i.test(normalized)) {
    return "Tên danh mục vượt quá độ dài cho phép.";
  }
  if (/description must not exceed/i.test(normalized)) {
    return "Mô tả vượt quá độ dài cho phép.";
  }
  if (/image must be a valid url/i.test(normalized)) {
    return "Ảnh phải là URL hợp lệ.";
  }
  if (/icon value must not be empty/i.test(normalized)) {
    return "Biểu tượng không được để trống.";
  }
  if (/position must be a number/i.test(normalized)) {
    return "Vị trí phải là số.";
  }
  if (/position must be greater than or equal to 0/i.test(normalized)) {
    return "Vị trí phải lớn hơn hoặc bằng 0.";
  }
  if (/^".+" is required$/i.test(normalized)) {
    return `${fieldLabel} là bắt buộc.`;
  }
  if (/^".+" is not allowed to be empty$/i.test(normalized)) {
    return `${fieldLabel} không được để trống.`;
  }
  if (/^".+" must be a valid email$/i.test(normalized)) {
    return `${fieldLabel} không đúng định dạng email.`;
  }
  if (/^".+" must be one of /i.test(normalized)) {
    return `${fieldLabel} không hợp lệ.`;
  }

  return "";
};

const localizeByJoiType = (detail, fieldLabel) => {
  const type = detail?.type || "";
  const limit = detail?.context?.limit;

  switch (type) {
    case "any.required":
      return `${fieldLabel} là bắt buộc.`;
    case "any.only":
      return `${fieldLabel} không hợp lệ hoặc không khớp.`;
    case "any.invalid":
      return `${fieldLabel} không hợp lệ.`;
    case "string.base":
      return `${fieldLabel} phải là chuỗi ký tự.`;
    case "string.empty":
      return `${fieldLabel} không được để trống.`;
    case "string.email":
      return `${fieldLabel} không đúng định dạng email.`;
    case "string.pattern.base":
      if (fieldLabel.toLowerCase().includes("điện thoại")) {
        return "Số điện thoại không đúng định dạng.";
      }
      if (fieldLabel.toLowerCase().includes("mã")) {
        return `${fieldLabel} không đúng định dạng.`;
      }
      return `${fieldLabel} không đúng định dạng.`;
    case "string.min":
      return `${fieldLabel} phải có ít nhất ${limit} ký tự.`;
    case "string.max":
      return `${fieldLabel} không được vượt quá ${limit} ký tự.`;
    case "string.length":
      return `${fieldLabel} phải có đúng ${limit} ký tự.`;
    case "string.uri":
      return `${fieldLabel} phải là URL hợp lệ.`;
    case "number.base":
      return `${fieldLabel} phải là số.`;
    case "number.integer":
      return `${fieldLabel} phải là số nguyên.`;
    case "number.min":
      return `${fieldLabel} phải lớn hơn hoặc bằng ${limit}.`;
    case "number.max":
      return `${fieldLabel} phải nhỏ hơn hoặc bằng ${limit}.`;
    case "date.base":
    case "date.format":
      return `${fieldLabel} không đúng định dạng ngày giờ.`;
    case "array.base":
      return `${fieldLabel} phải là danh sách.`;
    case "array.min":
      return `${fieldLabel} phải có ít nhất ${limit} phần tử.`;
    case "object.base":
      return `${fieldLabel} phải là đối tượng hợp lệ.`;
    case "object.min":
      return `Cần cung cấp ít nhất ${limit} trường dữ liệu.`;
    case "object.unknown":
      return `${fieldLabel} không được hỗ trợ.`;
    default:
      return "";
  }
};

const getLocalizedValidationMessage = (error) => {
  const detail = error?.details?.[0];
  if (!detail) {
    return "Dữ liệu gửi lên chưa hợp lệ.";
  }

  const fieldLabel = toFieldLabel(detail.path);
  const localizedCustom = localizeEnglishValidationMessage(detail.message, fieldLabel);
  if (localizedCustom) {
    return localizedCustom;
  }

  const localizedByType = localizeByJoiType(detail, fieldLabel);
  if (localizedByType) {
    return localizedByType;
  }

  return detail.message || "Dữ liệu gửi lên chưa hợp lệ.";
};

export const validateRequest = (schema) => {
  return async (req, res, next) => {
    try {
      const validationData = {};

      if (schema.describe().keys.body) {
        validationData.body = req.body;
      }
      if (schema.describe().keys.query) {
        validationData.query = req.query;
      }
      if (schema.describe().keys.params) {
        validationData.params = req.params;
      }

      await schema.validateAsync(validationData, {
        allowUnknown: false,
        stripUnknown: { objects: true },
      });
      next();
    } catch (error) {
      res.status(400).json({
        success: false,
        message: getLocalizedValidationMessage(error),
      });
    }
  };
};
