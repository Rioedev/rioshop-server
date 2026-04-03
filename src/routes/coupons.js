import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validation.js";
import {
  validateCoupon,
  getActiveCoupons,
  getMyAvailableCoupons,
  getCouponByCode,
  getAdminCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from "../controllers/couponController.js";
import {
  validateCouponValidation,
  getActiveCouponsValidation,
  getCouponByCodeValidation,
  getAdminCouponsValidation,
  createCouponValidation,
  updateCouponValidation,
  deleteCouponValidation,
} from "../validations/coupons.js";

const router = express.Router();

// Admin CRUD
router.get(
  "/admin",
  authenticateToken,
  validateRequest(getAdminCouponsValidation),
  getAdminCoupons,
);
router.post(
  "/admin",
  authenticateToken,
  validateRequest(createCouponValidation),
  createCoupon,
);
router.put(
  "/admin/:id",
  authenticateToken,
  validateRequest(updateCouponValidation),
  updateCoupon,
);
router.delete(
  "/admin/:id",
  authenticateToken,
  validateRequest(deleteCouponValidation),
  deleteCoupon,
);

// Validate coupon
router.post("/validate", validateRequest(validateCouponValidation), validateCoupon);

// Get active coupons
router.get("/", validateRequest(getActiveCouponsValidation), getActiveCoupons);

// Get available coupons for current user
router.get(
  "/me/available",
  authenticateToken,
  validateRequest(getActiveCouponsValidation),
  getMyAvailableCoupons,
);

// Get coupon
router.get("/:code", validateRequest(getCouponByCodeValidation), getCouponByCode);

export default router;
