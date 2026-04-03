import {
  asyncHandler,
  sendError,
  sendSuccess,
  getPaginationParams,
} from "../utils/helpers.js";
import couponService from "../services/couponService.js";

const ensureAdminAccess = (req, res) => {
  if (!req.user?.adminId) {
    sendError(res, 403, "Only admin can manage coupons");
    return false;
  }

  return true;
};

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

export const getMyAvailableCoupons = asyncHandler(async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) {
    return sendError(res, 403, "User authentication required");
  }

  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);
  const coupons = await couponService.getAvailableCouponsForUser(userId, {}, { page, limit });
  sendSuccess(res, 200, coupons, "Available coupons retrieved");
});

export const getCouponByCode = asyncHandler(async (req, res) => {
  const coupon = await couponService.getCouponByCode(req.params.code);

  if (!coupon) {
    return sendError(res, 404, "Coupon not found");
  }

  sendSuccess(res, 200, coupon, "Coupon retrieved");
});

export const getAdminCoupons = asyncHandler(async (req, res) => {
  if (!ensureAdminAccess(req, res)) {
    return;
  }

  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);
  const coupons = await couponService.getCoupons(
    {
      keyword: req.query.keyword,
      type: req.query.type,
      isActive: req.query.isActive,
    },
    { page, limit },
  );

  sendSuccess(res, 200, coupons, "Admin coupons retrieved");
});

export const createCoupon = asyncHandler(async (req, res) => {
  if (!ensureAdminAccess(req, res)) {
    return;
  }

  const coupon = await couponService.createCoupon({
    ...req.body,
    createdBy: req.user.adminId,
  });

  sendSuccess(res, 201, coupon, "Coupon created");
});

export const updateCoupon = asyncHandler(async (req, res) => {
  if (!ensureAdminAccess(req, res)) {
    return;
  }

  const coupon = await couponService.updateCoupon(req.params.id, req.body);
  if (!coupon) {
    return sendError(res, 404, "Coupon not found");
  }

  sendSuccess(res, 200, coupon, "Coupon updated");
});

export const deleteCoupon = asyncHandler(async (req, res) => {
  if (!ensureAdminAccess(req, res)) {
    return;
  }

  const coupon = await couponService.deleteCoupon(req.params.id);
  if (!coupon) {
    return sendError(res, 404, "Coupon not found");
  }

  sendSuccess(res, 200, coupon, "Coupon deleted");
});
