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
  READY_TO_SHIP: "ready_to_ship",
  SHIPPING: "shipping",
  DELIVERED: "delivered",
  COMPLETED: "completed",
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
  SALES: "sales",
};

export const ADMIN_STAFF_ROLES = [
  ADMIN_ROLE.WAREHOUSE,
  ADMIN_ROLE.SALES,
];

export const ADMIN_ALL_ROLES = [
  ADMIN_ROLE.SUPERADMIN,
  ADMIN_ROLE.MANAGER,
  ...ADMIN_STAFF_ROLES,
];

export const LEGACY_ADMIN_ROLE_MAP = {
  cs: ADMIN_ROLE.SALES,
  marketer: ADMIN_ROLE.SALES,
};

export const normalizeAdminRole = (role) => LEGACY_ADMIN_ROLE_MAP[role] || role;

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
