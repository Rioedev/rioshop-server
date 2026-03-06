// Product-related constants
export const PRODUCT_STATUS = {
  DRAFT: "draft",
  ACTIVE: "active",
  ARCHIVED: "archived",
  OUT_OF_STOCK: "out_of_stock",
};

export const PRODUCT_GENDER = {
  MEN: "men",
  WOMEN: "women",
  UNISEX: "unisex",
  KIDS: "kids",
};

// Order-related constants
export const ORDER_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PACKING: "packing",
  SHIPPING: "shipping",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  RETURNED: "returned",
};

export const PAYMENT_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  REFUNDED: "refunded",
  FAILED: "failed",
};

export const PAYMENT_METHOD = {
  COD: "cod",
  BANK_TRANSFER: "bank_transfer",
  MOMO: "momo",
  VNPAY: "vnpay",
  ZALOPAY: "zalopay",
  CARD: "card",
};

// User constants
export const USER_STATUS = {
  ACTIVE: "active",
  BANNED: "banned",
  INACTIVE: "inactive",
};

export const LOYALTY_TIER = {
  BRONZE: "bronze",
  SILVER: "silver",
  GOLD: "gold",
  PLATINUM: "platinum",
};

// Admin roles
export const ADMIN_ROLE = {
  SUPERADMIN: "superadmin",
  MANAGER: "manager",
  WAREHOUSE: "warehouse",
  CS: "cs",
  MARKETER: "marketer",
};

// Sizes
export const PRODUCT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];

// Shipping carriers
export const SHIPPING_CARRIERS = {
  GHN: "GHN",
  GHTK: "GHTK",
  VIETTEL: "Viettel Post",
};

// Cache keys
export const CACHE_KEYS = {
  PRODUCT: "product:",
  CATEGORY: "category:",
  USER: "user:",
  CART: "cart:",
  INVENTORY: "inventory:",
};

export const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 3600, // 1 hour
  LONG: 86400, // 24 hours
};
