import express from "express";
import { validateRequest } from "../middlewares/validation.js";
import {
  validateCoupon,
  getActiveCoupons,
  getCouponByCode,
} from "../controllers/couponController.js";
import {
  validateCouponValidation,
  getActiveCouponsValidation,
  getCouponByCodeValidation,
} from "../validations/coupons.js";

const router = express.Router();

// Validate coupon
router.post("/validate", validateRequest(validateCouponValidation), validateCoupon);

// Get active coupons
router.get("/", validateRequest(getActiveCouponsValidation), getActiveCoupons);

// Get coupon
router.get("/:code", validateRequest(getCouponByCodeValidation), getCouponByCode);

export default router;
