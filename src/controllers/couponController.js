import {
  asyncHandler,
  sendError,
  sendSuccess,
  getPaginationParams,
} from "../utils/helpers.js";
import couponService from "../services/couponService.js";

export const validateCoupon = asyncHandler(async (req, res) => {
  const {
    code,
    userId,
    orderValue,
    shippingFee,
    productIds,
    categoryIds,
    brandNames,
  } = req.body;

  const result = await couponService.validateCoupon(code, {
    userId,
    orderValue,
    shippingFee,
    productIds,
    categoryIds,
    brandNames,
  });

  sendSuccess(res, 200, result, "Coupon validated");
});

export const getActiveCoupons = asyncHandler(async (req, res) => {
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);
  const coupons = await couponService.getActiveCoupons({}, { page, limit });
  sendSuccess(res, 200, coupons, "Coupons retrieved");
});

export const getCouponByCode = asyncHandler(async (req, res) => {
  const coupon = await couponService.getCouponByCode(req.params.code);

  if (!coupon) {
    return sendError(res, 404, "Coupon not found");
  }

  sendSuccess(res, 200, coupon, "Coupon retrieved");
});
