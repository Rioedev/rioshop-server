/**
 * APPLICATION CONSTANTS
 */

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
};

export const ERROR_MESSAGES = {
  // Auth
  INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng",
  EMAIL_EXISTS: "Email đã tồn tại",
  NO_TOKEN: "Không có token được cung cấp",
  INVALID_TOKEN: "Token không hợp lệ",
  UNAUTHORIZED: "Bạn không có quyền truy cập",
  TOKEN_EXPIRED: "Token đã hết hạn",

  // Product
  PRODUCT_NOT_FOUND: "Sản phẩm không tìm thấy",
  INVALID_PRODUCT_DATA: "Dữ liệu sản phẩm không hợp lệ",
  IMAGE_REQUIRED: "Ảnh sản phẩm là bắt buộc",

  // Category
  CATEGORY_NOT_FOUND: "Danh mục không tìm thấy",
  CATEGORY_IMAGE_REQUIRED: "Ảnh danh mục là bắt buộc",
  SLUG_EXISTS: "Slug đã tồn tại",
  INVALID_CATEGORY_DATA: "Dữ liệu danh mục không hợp lệ",

  // General
  INTERNAL_SERVER_ERROR: "Lỗi hệ thống",
  INVALID_REQUEST: "Yêu cầu không hợp lệ",
  NOT_FOUND: "Tài nguyên không tìm thấy",
};

export const SUCCESS_MESSAGES = {
  // Auth
  REGISTER_SUCCESS: "Đăng ký thành công",
  LOGIN_SUCCESS: "Đăng nhập thành công",

  // Product
  PRODUCT_CREATED: "Tạo sản phẩm thành công",
  PRODUCT_UPDATED: "Cập nhật sản phẩm thành công",
  PRODUCT_DELETED: "Xóa sản phẩm thành công",
  PRODUCT_RESTORED: "Khôi phục sản phẩm thành công",

  // Category
  CATEGORY_CREATED: "Thêm danh mục thành công",
  CATEGORY_UPDATED: "Cập nhật danh mục thành công",
  CATEGORY_DELETED: "Xóa danh mục thành công",
  CATEGORY_RESTORED: "Khôi phục danh mục thành công",
};

export const CLOUDINARY_CONFIG = {
  PRODUCT_FOLDER: "rioshop/products",
  CATEGORY_FOLDER: "rioshop/categories",
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
};

export const FILE_UPLOAD_CONFIG = {
  PRODUCT_MAX_FILES: 20,
  CATEGORY_MAX_FILES: 1,
  ALLOWED_MIME_TYPES: ["image/jpeg", "image/png", "image/webp"],
};

export const PAGINATION_CONFIG = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
};

export const JWT_CONFIG = {
  EXPIRES_IN: "7d",
};

export const VALIDATION_CONFIG = {
  JSON_FIELDS: ["options", "variants", "specs", "seo", "categoryIds"],
};
