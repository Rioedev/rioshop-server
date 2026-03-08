import Coupon from "../models/Coupon.js";
import { AppError } from "../utils/helpers.js";

export class CouponService {
  async getCouponByCode(code) {
    try {
      if (!code || typeof code !== "string") {
        return null;
      }

      return await Coupon.findOne({ code: code.toUpperCase() });
    } catch (error) {
      throw error;
    }
  }

  async getActiveCoupons(filters = {}, options = {}) {
    const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
    const now = new Date();
    const query = {
      isActive: true,
      startsAt: { $lte: now },
      expiresAt: { $gte: now },
      ...filters,
    };

    try {
      const skip = (page - 1) * limit;
      const [coupons, totalDocs] = await Promise.all([
        Coupon.find(query).sort(sort).skip(skip).limit(limit),
        Coupon.countDocuments(query),
      ]);

      return {
        docs: coupons,
        totalDocs,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalDocs / limit)),
        hasPrevPage: page > 1,
        hasNextPage: skip + coupons.length < totalDocs,
      };
    } catch (error) {
      throw error;
    }
  }

  async validateCoupon(code, context = {}) {
    const {
      userId = null,
      orderValue = 0,
      shippingFee = 0,
      productIds = [],
      categoryIds = [],
      brandNames = [],
    } = context;

    try {
      const coupon = await this.getCouponByCode(code);
      if (!coupon) {
        return this.invalidResult(orderValue, shippingFee, "Coupon not found");
      }

      const now = new Date();

      if (!coupon.isActive) {
        return this.invalidResult(
          orderValue,
          shippingFee,
          "Coupon is not active",
        );
      }

      if (coupon.startsAt > now) {
        return this.invalidResult(
          orderValue,
          shippingFee,
          "Coupon is not valid yet",
        );
      }

      if (coupon.expiresAt < now) {
        return this.invalidResult(orderValue, shippingFee, "Coupon has expired");
      }

      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        return this.invalidResult(
          orderValue,
          shippingFee,
          "Coupon usage limit reached",
        );
      }

      if (
        userId &&
        Array.isArray(coupon.eligibleUsers) &&
        coupon.eligibleUsers.length > 0 &&
        !coupon.eligibleUsers.some((id) => id.toString() === userId.toString())
      ) {
        return this.invalidResult(
          orderValue,
          shippingFee,
          "User is not eligible for this coupon",
        );
      }

      if (userId && coupon.perUserLimit) {
        const userUsageCount = (coupon.usedBy || []).filter(
          (entry) => entry.userId?.toString() === userId.toString(),
        ).length;

        if (userUsageCount >= coupon.perUserLimit) {
          return this.invalidResult(
            orderValue,
            shippingFee,
            "User coupon usage limit reached",
          );
        }
      }

      if (coupon.minOrderValue && orderValue < coupon.minOrderValue) {
        return this.invalidResult(
          orderValue,
          shippingFee,
          `Minimum order value is ${coupon.minOrderValue}`,
        );
      }

      const hasScopedTargets =
        (coupon.applicableTo?.categories || []).length > 0 ||
        (coupon.applicableTo?.products || []).length > 0 ||
        (coupon.applicableTo?.brands || []).length > 0;

      if (hasScopedTargets) {
        const categoryMatch = this.intersects(
          coupon.applicableTo?.categories || [],
          categoryIds,
        );
        const productMatch = this.intersects(
          coupon.applicableTo?.products || [],
          productIds,
        );
        const brandMatch = this.intersects(
          coupon.applicableTo?.brands || [],
          brandNames,
        );

        if (!categoryMatch && !productMatch && !brandMatch) {
          return this.invalidResult(
            orderValue,
            shippingFee,
            "Coupon does not apply to the selected items",
          );
        }
      }

      if (
        (coupon.excludedProducts || []).length > 0 &&
        this.intersects(coupon.excludedProducts || [], productIds)
      ) {
        return this.invalidResult(
          orderValue,
          shippingFee,
          "Coupon is not applicable for one or more items in cart",
        );
      }

      const discount = this.calculateDiscount(coupon, orderValue, shippingFee);
      const gross = orderValue + shippingFee;

      return {
        isValid: true,
        reason: null,
        coupon,
        discount,
        finalAmount: Math.max(0, gross - discount),
      };
    } catch (error) {
      throw error;
    }
  }

  async markCouponUsed(couponId, payload = {}) {
    const { userId = null, orderId = null } = payload;

    try {
      const coupon = await Coupon.findById(couponId);
      if (!coupon) {
        throw new AppError("Coupon not found", 404);
      }

      coupon.usageCount = (coupon.usageCount || 0) + 1;

      if (userId) {
        coupon.usedBy = coupon.usedBy || [];
        coupon.usedBy.push({
          userId,
          orderId,
          usedAt: new Date(),
        });
      }

      await coupon.save();
      return coupon;
    } catch (error) {
      throw error;
    }
  }

  async createCoupon(data) {
    try {
      const existing = await Coupon.findOne({ code: data.code.toUpperCase() });
      if (existing) {
        throw new AppError("Coupon code already exists", 409);
      }

      const coupon = new Coupon({
        ...data,
        code: data.code.toUpperCase(),
      });
      await coupon.save();
      return coupon;
    } catch (error) {
      throw error;
    }
  }

  async updateCoupon(id, data) {
    try {
      const updateData = { ...data };
      if (updateData.code) {
        updateData.code = updateData.code.toUpperCase();
      }

      return await Coupon.findByIdAndUpdate(id, updateData, { new: true });
    } catch (error) {
      throw error;
    }
  }

  async deactivateCoupon(id) {
    try {
      return await Coupon.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true },
      );
    } catch (error) {
      throw error;
    }
  }

  intersects(left = [], right = []) {
    const rightSet = new Set((right || []).map((item) => item.toString()));
    return (left || []).some((item) => rightSet.has(item.toString()));
  }

  calculateDiscount(coupon, orderValue, shippingFee) {
    let discount = 0;

    if (coupon.type === "percent") {
      discount = (orderValue * coupon.value) / 100;
    } else if (coupon.type === "fixed") {
      discount = coupon.value;
    } else if (coupon.type === "free_ship") {
      discount = shippingFee;
    } else {
      discount = 0;
    }

    if (coupon.maxDiscount) {
      discount = Math.min(discount, coupon.maxDiscount);
    }

    return Math.max(0, Math.min(discount, orderValue + shippingFee));
  }

  invalidResult(orderValue, shippingFee, reason) {
    return {
      isValid: false,
      reason,
      coupon: null,
      discount: 0,
      finalAmount: orderValue + shippingFee,
    };
  }
}

export default new CouponService();
