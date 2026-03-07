import express from "express";
import { asyncHandler, sendSuccess } from "../utils/helpers.js";

const router = express.Router();

// Get coupon
router.get(
  "/:code",
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Coupon retrieved");
  }),
);

// Validate coupon
router.post(
  "/validate",
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Coupon validated");
  }),
);

// Get active coupons
router.get(
  "/",
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, { coupons: [] }, "Coupons retrieved");
  }),
);

export default router;
