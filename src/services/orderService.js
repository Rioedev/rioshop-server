import Order from "../models/Order.js";
import User from "../models/User.js";
import couponService from "./couponService.js";
import { AppError } from "../utils/helpers.js";

const ORDER_STATUSES = new Set([
  "pending",
  "confirmed",
  "packing",
  "shipping",
  "delivered",
  "cancelled",
  "returned",
]);

const CANCELLABLE_STATUSES = new Set(["pending", "confirmed"]);

export class OrderService {
  async getOrders(filters = {}, options = {}) {
    const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;

    try {
      return await Order.paginate(filters, {
        page,
        limit,
        sort,
        populate: [
          { path: "paymentId" },
          { path: "shipmentId" },
          { path: "items.productId", select: "_id name slug media" },
        ],
      });
    } catch (error) {
      throw error;
    }
  }

  async getOrderById(orderId, userId = null) {
    try {
      const query = { _id: orderId };
      if (userId) {
        query.userId = userId;
      }

      return await Order.findOne(query).populate([
        { path: "paymentId" },
        { path: "shipmentId" },
        { path: "items.productId", select: "_id name slug media" },
      ]);
    } catch (error) {
      throw error;
    }
  }

  async createOrder(userId, data) {
    try {
      const items = this.normalizeItems(data.items || []);
      if (items.length === 0) {
        throw new AppError("Order must contain at least one item", 400);
      }

      const shippingFeeInput =
        data.shippingFee !== undefined
          ? Number(data.shippingFee)
          : Number(data.pricing?.shippingFee || 0);

      let couponCode = data.couponCode || null;
      let couponDiscount = Number(data.couponDiscount || 0);

      if (couponCode) {
        const validation = await couponService.validateCoupon(couponCode, {
          userId,
          orderValue: items.reduce((sum, item) => sum + item.totalPrice, 0),
          shippingFee: shippingFeeInput,
          productIds: items.map((item) => item.productId),
        });

        if (!validation.isValid) {
          throw new AppError(validation.reason, 400);
        }

        couponCode = validation.coupon.code;
        couponDiscount = validation.discount;
      }

      const pricing = this.calculatePricing(items, {
        shippingFee: shippingFeeInput,
        discount: couponDiscount,
        currency: data.pricing?.currency || "VND",
      });

      const customerSnapshot = await this.buildCustomerSnapshot(
        userId,
        data.customerSnapshot || {},
      );

      const order = new Order({
        orderNumber: data.orderNumber || (await this.generateOrderNumber()),
        userId,
        customerSnapshot,
        items,
        shippingAddress: data.shippingAddress || {},
        pricing,
        couponCode,
        couponDiscount,
        loyaltyPointsUsed: Number(data.loyaltyPointsUsed || 0),
        loyaltyPointsEarned: Number(data.loyaltyPointsEarned || 0),
        paymentMethod: data.paymentMethod || "cod",
        paymentStatus: data.paymentStatus || "pending",
        shippingMethod: data.shippingMethod || "standard",
        shippingCarrier: data.shippingCarrier || null,
        shippingFee: pricing.shippingFee,
        status: data.status || "pending",
        note: data.note || "",
        adminNote: data.adminNote || "",
        source: data.source || "web",
        timeline: [
          {
            status: data.status || "pending",
            note: "Order created",
            at: new Date(),
            by: userId ? "user" : "guest",
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await order.save();

      if (couponCode) {
        const coupon = await couponService.getCouponByCode(couponCode);
        if (coupon) {
          await couponService.markCouponUsed(coupon._id, {
            userId,
            orderId: order._id,
          });
        }
      }

      if (userId) {
        await User.findByIdAndUpdate(userId, {
          $inc: {
            totalOrders: 1,
            totalSpend: pricing.total,
          },
          updatedAt: new Date(),
        });
      }

      return await this.getOrderById(order._id, null);
    } catch (error) {
      throw error;
    }
  }

  async updateOrderStatus(orderId, status, payload = {}) {
    const { note = "", updatedBy = "system", paymentStatus = null } = payload;

    try {
      if (!ORDER_STATUSES.has(status)) {
        throw new AppError("Invalid order status", 400);
      }

      const order = await Order.findById(orderId);
      if (!order) {
        throw new AppError("Order not found", 404);
      }

      order.status = status;
      if (paymentStatus) {
        order.paymentStatus = paymentStatus;
      }
      if (note) {
        order.adminNote = note;
      }
      order.timeline = order.timeline || [];
      order.timeline.push({
        status,
        note,
        at: new Date(),
        by: updatedBy,
      });
      order.updatedAt = new Date();

      await order.save();
      return order;
    } catch (error) {
      throw error;
    }
  }

  async cancelOrder(orderId, userId = null, payload = {}) {
    const { note = "Order cancelled", cancelledBy = "user" } = payload;

    try {
      const query = { _id: orderId };
      if (userId) {
        query.userId = userId;
      }

      const order = await Order.findOne(query);
      if (!order) {
        throw new AppError("Order not found", 404);
      }

      if (!CANCELLABLE_STATUSES.has(order.status)) {
        throw new AppError("Order can no longer be cancelled", 400);
      }

      order.status = "cancelled";
      order.timeline = order.timeline || [];
      order.timeline.push({
        status: "cancelled",
        note,
        at: new Date(),
        by: cancelledBy,
      });
      order.updatedAt = new Date();

      await order.save();
      return order;
    } catch (error) {
      throw error;
    }
  }

  async attachPayment(orderId, paymentId, paymentStatus = "paid") {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new AppError("Order not found", 404);
      }

      order.paymentId = paymentId;
      order.paymentStatus = paymentStatus;
      order.updatedAt = new Date();
      await order.save();

      return order;
    } catch (error) {
      throw error;
    }
  }

  async getOrderStats(range = {}) {
    const now = new Date();
    const startDate = range.startDate
      ? new Date(range.startDate)
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const endDate = range.endDate ? new Date(range.endDate) : now;

    try {
      const stats = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalOrders: { $sum: 1 },
                  totalRevenue: { $sum: "$pricing.total" },
                },
              },
            ],
            byStatus: [
              {
                $group: {
                  _id: "$status",
                  count: { $sum: 1 },
                },
              },
            ],
          },
        },
      ]);

      return stats[0] || { totals: [], byStatus: [] };
    } catch (error) {
      throw error;
    }
  }

  normalizeItems(items = []) {
    return items.map((item) => {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);
      const totalPrice = Number(item.totalPrice || quantity * unitPrice);

      if (!item.productId || !item.variantSku || !item.productName || quantity <= 0) {
        throw new AppError("Invalid order item payload", 400);
      }

      return {
        productId: item.productId,
        variantSku: item.variantSku,
        productName: item.productName,
        variantLabel: item.variantLabel || item.variantSku,
        image: item.image || "",
        unitPrice,
        quantity,
        totalPrice,
        returnedQty: Number(item.returnedQty || 0),
      };
    });
  }

  calculatePricing(items = [], payload = {}) {
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const shippingFee = Number(payload.shippingFee || 0);
    const discount = Number(payload.discount || 0);
    const total = Math.max(0, subtotal + shippingFee - discount);

    return {
      subtotal,
      discount,
      shippingFee,
      total,
      currency: payload.currency || "VND",
    };
  }

  async buildCustomerSnapshot(userId, snapshot) {
    if (snapshot?.name) {
      return {
        name: snapshot.name,
        email: snapshot.email || "",
        phone: snapshot.phone || "",
      };
    }

    if (!userId) {
      throw new AppError("Customer name is required for guest checkout", 400);
    }

    const user = await User.findById(userId).select("fullName email phone");
    if (!user) {
      throw new AppError("User not found", 404);
    }

    return {
      name: user.fullName,
      email: user.email || "",
      phone: user.phone || "",
    };
  }

  async generateOrderNumber() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const now = new Date();
      const datePart = now.toISOString().slice(2, 10).replace(/-/g, "");
      const randomPart = Math.floor(Math.random() * 900000 + 100000);
      const orderNumber = `RS${datePart}${randomPart}`;

      const exists = await Order.exists({ orderNumber });
      if (!exists) {
        return orderNumber;
      }
    }

    throw new AppError("Failed to generate order number", 500);
  }
}

export default new OrderService();
