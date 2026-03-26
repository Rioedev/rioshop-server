import Order from "../models/Order.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Inventory from "../models/Inventory.js";
import Shipment from "../models/Shipment.js";
import couponService from "./couponService.js";
import emailService from "./emailService.js";
import notificationService from "./notificationService.js";
import { GHNShippingService } from "./shippingService.js";
import { SINGLE_WAREHOUSE_ID, SINGLE_WAREHOUSE_NAME } from "../constants/warehouse.js";
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
const ORDER_FLOW_STATUSES = ["pending", "confirmed", "packing", "shipping", "delivered"];
const INVENTORY_RESERVE_FROM_STATUS = (process.env.INVENTORY_RESERVE_FROM_STATUS || "pending")
  .toString()
  .trim()
  .toLowerCase();
const INVENTORY_COMMIT_AT_STATUS = (process.env.INVENTORY_COMMIT_AT_STATUS || "packing")
  .toString()
  .trim()
  .toLowerCase();

const buildInventoryPhaseConfig = () => {
  const pendingIndex = ORDER_FLOW_STATUSES.indexOf("pending");
  const packingIndex = ORDER_FLOW_STATUSES.indexOf("packing");
  const reserveFromIndex = ORDER_FLOW_STATUSES.indexOf(INVENTORY_RESERVE_FROM_STATUS);
  const commitAtIndex = ORDER_FLOW_STATUSES.indexOf(INVENTORY_COMMIT_AT_STATUS);

  const safeReserveFromIndex = reserveFromIndex >= 0 ? reserveFromIndex : pendingIndex;
  const safeCommitAtIndex =
    commitAtIndex >= safeReserveFromIndex ? commitAtIndex : Math.max(packingIndex, safeReserveFromIndex);

  return {
    reservationStatuses: new Set(ORDER_FLOW_STATUSES.slice(safeReserveFromIndex, safeCommitAtIndex)),
    committedStatuses: new Set(ORDER_FLOW_STATUSES.slice(safeCommitAtIndex)),
  };
};

const { reservationStatuses: RESERVATION_STATUSES, committedStatuses: COMMITTED_INVENTORY_STATUSES } =
  buildInventoryPhaseConfig();
const TERMINAL_STATUSES = new Set(["cancelled", "returned"]);
const ALLOWED_STATUS_TRANSITIONS = {
  pending: new Set(["confirmed", "packing", "shipping", "cancelled"]),
  confirmed: new Set(["packing", "shipping", "cancelled"]),
  packing: new Set(["shipping", "cancelled"]),
  shipping: new Set(["delivered", "returned", "cancelled"]),
  delivered: new Set(["returned"]),
  cancelled: new Set(),
  returned: new Set(),
};

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
    const normalizedItems = this.normalizeItems(data.items || []);
    if (normalizedItems.length === 0) {
      throw new AppError("Order must contain at least one item", 400);
    }

    const items = await this.resolveOrderItems(normalizedItems);
    const shippingCarrier = this.resolveShippingCarrier(data);
    let shippingFeeInput =
      data.shippingFee !== undefined
        ? Number(data.shippingFee)
        : Number(data.pricing?.shippingFee || 0);

    if (this.shouldUseGhnShipping(data.shippingMethod, shippingCarrier)) {
      const ghnShippingFee = await this.resolveGhnShippingFee({
        items,
        shippingAddress: data.shippingAddress || {},
        shippingMethod: data.shippingMethod || "standard",
      });
      if (Number.isFinite(ghnShippingFee)) {
        shippingFeeInput = ghnShippingFee;
      }
    }

    let couponCode = data.couponCode || null;
    let couponDiscount = Number(data.couponDiscount || 0);
    let couponId = null;

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
      couponId = validation.coupon._id;
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

    const nextStatus = data.status || "pending";
    if (!ORDER_STATUSES.has(nextStatus)) {
      throw new AppError("Invalid order status", 400);
    }

    const session = await Order.startSession();
    let createdOrderId = null;

    try {
      await session.withTransaction(async () => {
        await this.applyInventoryForNewOrder(items, nextStatus, session);

        const order = new Order({
          orderNumber: data.orderNumber || (await this.generateOrderNumber(session)),
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
          shippingCarrier,
          shippingFee: pricing.shippingFee,
          status: nextStatus,
          note: data.note || "",
          adminNote: data.adminNote || "",
          source: data.source || "web",
          timeline: [
            {
              status: nextStatus,
              note: "Order created",
              at: new Date(),
              by: userId ? "user" : "guest",
            },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await order.save({ session });
        createdOrderId = order._id;

        if (couponCode && couponId) {
          await couponService.markCouponUsed(
            couponId,
            {
              userId,
              orderId: order._id,
            },
            { session },
          );
        }

        if (userId) {
          await User.findByIdAndUpdate(
            userId,
            {
              $inc: {
                totalOrders: 1,
                totalSpend: pricing.total,
              },
              updatedAt: new Date(),
            },
            { session },
          );
        }
      });
    } finally {
      await session.endSession();
    }

    if (!createdOrderId) {
      throw new AppError("Failed to create order", 500);
    }

    const createdOrder = await this.getOrderById(createdOrderId, null);
    void emailService.sendOrderConfirmation(createdOrder);
    void notificationService.notifyOrderCreated(createdOrder);
    return createdOrder;
  }

  async updateOrderStatus(orderId, status, payload = {}) {
    const { note = "", updatedBy = "system", paymentStatus = null, userId = null } = payload;

    if (!ORDER_STATUSES.has(status)) {
      throw new AppError("Invalid order status", 400);
    }

    const session = await Order.startSession();
    let updatedOrderId = null;
    let previousStatus = "";
    let previousPaymentStatus = "";

    try {
      await session.withTransaction(async () => {
        const query = userId ? { _id: orderId, userId } : { _id: orderId };
        const order = await Order.findOne(query).session(session);
        if (!order) {
          throw new AppError("Order not found", 404);
        }

        previousStatus = order.status;
        previousPaymentStatus = order.paymentStatus || "pending";
        this.assertStatusTransition(order.status, status);
        await this.applyInventoryForStatusTransition(order.items || [], order.status, status, session);

        const effectiveShippingCarrier =
          order.shippingCarrier || this.resolveShippingCarrier({ shippingMethod: order.shippingMethod });

        if (
          status === "shipping" &&
          order.status !== "shipping" &&
          this.shouldUseGhnShipping(order.shippingMethod, effectiveShippingCarrier) &&
          !order.shipmentId
        ) {
          const shipmentDoc = await this.createGhnShipmentForOrder(order, { session, note });
          order.shipmentId = shipmentDoc._id;
          order.shippingCarrier = "GHN";
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

        await order.save({ session });
        updatedOrderId = order._id;
      });
    } finally {
      await session.endSession();
    }

    if (!updatedOrderId) {
      throw new AppError("Failed to update order status", 500);
    }

    const updatedOrder = await this.getOrderById(updatedOrderId, userId || null);
    if (previousStatus && previousStatus !== updatedOrder?.status) {
      void emailService.sendOrderStatusUpdate(updatedOrder, previousStatus);
      void notificationService.notifyOrderStatusChanged(updatedOrder, previousStatus);
    }
    if (
      previousPaymentStatus &&
      updatedOrder?.paymentStatus &&
      previousPaymentStatus !== updatedOrder.paymentStatus
    ) {
      void emailService.sendPaymentStatusUpdate(
        updatedOrder,
        previousPaymentStatus,
        updatedOrder.paymentStatus,
      );
      void notificationService.notifyPaymentStatusChanged(
        updatedOrder,
        previousPaymentStatus,
        updatedOrder.paymentStatus,
      );
    }
    return updatedOrder;
  }

  async cancelOrder(orderId, userId = null, payload = {}) {
    const { note = "Order cancelled", cancelledBy = "user" } = payload;

    const session = await Order.startSession();
    let cancelledOrderId = null;
    let previousStatus = "";

    try {
      await session.withTransaction(async () => {
        const query = userId ? { _id: orderId, userId } : { _id: orderId };
        const order = await Order.findOne(query).session(session);
        if (!order) {
          throw new AppError("Order not found", 404);
        }

        if (!CANCELLABLE_STATUSES.has(order.status)) {
          throw new AppError("Order can no longer be cancelled", 400);
        }

        previousStatus = order.status;
        this.assertStatusTransition(order.status, "cancelled");
        await this.applyInventoryForStatusTransition(order.items || [], order.status, "cancelled", session);

        order.status = "cancelled";
        order.timeline = order.timeline || [];
        order.timeline.push({
          status: "cancelled",
          note,
          at: new Date(),
          by: cancelledBy,
        });
        order.updatedAt = new Date();

        await order.save({ session });
        cancelledOrderId = order._id;
      });
    } finally {
      await session.endSession();
    }

    if (!cancelledOrderId) {
      throw new AppError("Failed to cancel order", 500);
    }

    const cancelledOrder = await this.getOrderById(cancelledOrderId, userId || null);
    if (previousStatus && previousStatus !== cancelledOrder?.status) {
      void emailService.sendOrderStatusUpdate(cancelledOrder, previousStatus);
      void notificationService.notifyOrderStatusChanged(cancelledOrder, previousStatus);
    }
    return cancelledOrder;
  }

  async attachPayment(orderId, paymentId, paymentStatus = "paid") {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new AppError("Order not found", 404);
      }

      const previousPaymentStatus = order.paymentStatus || "pending";
      order.paymentId = paymentId;
      order.paymentStatus = paymentStatus;
      order.updatedAt = new Date();
      await order.save();
      if (previousPaymentStatus !== order.paymentStatus) {
        void emailService.sendPaymentStatusUpdate(
          order,
          previousPaymentStatus,
          order.paymentStatus,
        );
        void notificationService.notifyPaymentStatusChanged(
          order,
          previousPaymentStatus,
          order.paymentStatus,
        );
      }

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
    return (items || []).map((item) => {
      const quantity = Number(item.quantity || 0);

      if (!item.productId || quantity <= 0) {
        throw new AppError("Invalid order item payload", 400);
      }

      return {
        productId: item.productId.toString(),
        variantSku: (item.variantSku || "").toString().trim(),
        productName: (item.productName || "").toString().trim(),
        variantLabel: (item.variantLabel || "").toString().trim(),
        image: (item.image || "").toString().trim(),
        unitPrice: Number(item.unitPrice || 0),
        quantity,
        totalPrice: Number(item.totalPrice || 0),
        returnedQty: Number(item.returnedQty || 0),
      };
    });
  }

  async resolveOrderItems(items = []) {
    const productIds = [...new Set(items.map((item) => item.productId.toString()))];
    const products = await Product.find({
      _id: { $in: productIds },
      deletedAt: null,
    }).select("_id name pricing variants media weight dimensions");

    const productMap = new Map(products.map((product) => [product._id.toString(), product]));

    const merged = new Map();

    for (const item of items) {
      const product = productMap.get(item.productId.toString());
      if (!product) {
        throw new AppError(`Product ${item.productId} not found`, 404);
      }

      const trimmedVariantSku = item.variantSku?.trim() || "";
      const activeVariants = (product.variants || []).filter((variant) => variant.isActive !== false);
      const exactVariant = activeVariants.find(
        (variant) => (variant.sku || "").trim() === trimmedVariantSku,
      );
      let variant = exactVariant;

      if (!variant && (trimmedVariantSku === "" || trimmedVariantSku.endsWith("-default"))) {
        if (activeVariants.length === 1) {
          variant = activeVariants[0];
        } else {
          throw new AppError(
            `Variant SKU is required for product ${product._id} with multiple sizes/colors`,
            400,
          );
        }
      }

      if (!variant) {
        throw new AppError(`Variant ${trimmedVariantSku || "(missing)"} not found`, 400);
      }

      if (variant.isActive === false) {
        throw new AppError(`Variant ${variant.sku} is inactive`, 400);
      }

      const unitPrice = Math.max(
        0,
        Number(product.pricing?.salePrice || 0) + Number(variant.additionalPrice || 0),
      );
      const key = `${product._id.toString()}::${variant.sku}`;
      const fallbackImage =
        variant.images?.[0] ||
        product.media?.find((mediaItem) => mediaItem.type === "image" && mediaItem.url)?.url ||
        product.media?.[0]?.url ||
        item.image ||
        "";
      const variantLabel = item.variantLabel || this.buildVariantLabel(variant);

      if (merged.has(key)) {
        const existing = merged.get(key);
        existing.quantity += item.quantity;
        existing.totalPrice = existing.unitPrice * existing.quantity;
        continue;
      }

      merged.set(key, {
        productId: product._id.toString(),
        variantSku: variant.sku,
        productName: product.name,
        variantLabel,
        image: fallbackImage,
        unitPrice,
        quantity: item.quantity,
        totalPrice: unitPrice * item.quantity,
        returnedQty: Number(item.returnedQty || 0),
        packageWeightGr: Math.max(100, Number(product.weight || 0) || 300),
        packageLengthCm: Math.max(10, Number(product.dimensions?.lengthCm || 0) || 20),
        packageWidthCm: Math.max(10, Number(product.dimensions?.widthCm || 0) || 15),
        packageHeightCm: Math.max(1, Number(product.dimensions?.heightCm || 0) || 4),
      });
    }

    return Array.from(merged.values());
  }

  buildVariantLabel(variant) {
    const colorName = variant?.color?.name?.toString().trim();
    const sizeName = variant?.sizeLabel?.toString().trim() || variant?.size?.toString().trim();

    if (colorName && sizeName) {
      return `${colorName} / ${sizeName}`;
    }

    return colorName || sizeName || variant?.sku || "Default";
  }

  statusHoldsReservation(status) {
    return RESERVATION_STATUSES.has(status);
  }

  statusHasCommittedInventory(status) {
    return COMMITTED_INVENTORY_STATUSES.has(status);
  }

  assertStatusTransition(currentStatus, nextStatus) {
    if (currentStatus === nextStatus) {
      return;
    }

    if (TERMINAL_STATUSES.has(currentStatus)) {
      throw new AppError(`Cannot change status from ${currentStatus}`, 400);
    }

    const allowedNextStatuses = ALLOWED_STATUS_TRANSITIONS[currentStatus];
    if (!allowedNextStatuses?.has(nextStatus)) {
      throw new AppError(
        `Invalid order status transition: ${currentStatus} -> ${nextStatus}`,
        400,
      );
    }
  }

  async applyInventoryForNewOrder(items, status, session) {
    if (this.statusHoldsReservation(status)) {
      await this.applyInventoryAction(items, "reserve", session);
      return;
    }

    if (this.statusHasCommittedInventory(status)) {
      await this.applyInventoryAction(items, "sell", session);
    }
  }

  async applyInventoryForStatusTransition(items, currentStatus, nextStatus, session) {
    if (currentStatus === nextStatus) {
      return;
    }

    const currentReserved = this.statusHoldsReservation(currentStatus);
    const nextReserved = this.statusHoldsReservation(nextStatus);
    const currentCommitted = this.statusHasCommittedInventory(currentStatus);
    const nextCommitted = this.statusHasCommittedInventory(nextStatus);

    if ((currentReserved && nextReserved) || (currentCommitted && nextCommitted)) {
      return;
    }

    if (currentReserved && !nextReserved) {
      if (nextCommitted) {
        await this.applyInventoryAction(items, "commit", session);
      } else {
        await this.applyInventoryAction(items, "release", session);
      }
      return;
    }

    if (!currentReserved && nextReserved) {
      await this.applyInventoryAction(items, "reserve", session);
      return;
    }

    if (currentCommitted && !nextCommitted) {
      if (nextStatus === "cancelled" || nextStatus === "returned") {
        await this.applyInventoryAction(items, "restock", session);
      }
      return;
    }

    if (!currentCommitted && !currentReserved && nextCommitted) {
      await this.applyInventoryAction(items, "sell", session);
    }
  }

  async applyInventoryAction(items, action, session) {
    const grouped = new Map();

    for (const item of items) {
      const productId = item.productId.toString();
      const variantSku = (item.variantSku || "").trim();
      const quantity = Number(item.quantity || 0);

      if (!variantSku || quantity <= 0) {
        throw new AppError("Invalid order item for inventory operation", 400);
      }

      if (!grouped.has(productId)) {
        grouped.set(productId, new Map());
      }
      const productVariantMap = grouped.get(productId);
      productVariantMap.set(variantSku, (productVariantMap.get(variantSku) || 0) + quantity);
    }

    for (const [productId, skuMap] of grouped.entries()) {
      const product = await Product.findOne({ _id: productId, deletedAt: null }).session(session);
      if (!product) {
        throw new AppError(`Product ${productId} not found`, 404);
      }

      const variantMap = new Map(
        (product.variants || []).map((variant) => [(variant.sku || "").trim(), variant]),
      );

      let reservedDelta = 0;
      let soldDelta = 0;

      for (const [variantSku, quantity] of skuMap.entries()) {
        const variant = variantMap.get(variantSku);
        if (!variant) {
          throw new AppError(`Variant ${variantSku} not found`, 400);
        }

        if (action === "reserve") {
          if (Number(variant.stock || 0) < quantity) {
            throw new AppError(`Variant ${variantSku} is out of stock`, 409);
          }
          variant.stock = Number(variant.stock || 0) - quantity;
          reservedDelta += quantity;
        } else if (action === "release") {
          variant.stock = Number(variant.stock || 0) + quantity;
          reservedDelta -= quantity;
        } else if (action === "commit") {
          reservedDelta -= quantity;
          soldDelta += quantity;
        } else if (action === "sell") {
          if (Number(variant.stock || 0) < quantity) {
            throw new AppError(`Variant ${variantSku} is out of stock`, 409);
          }
          variant.stock = Number(variant.stock || 0) - quantity;
          soldDelta += quantity;
        } else if (action === "restock") {
          variant.stock = Number(variant.stock || 0) + quantity;
          soldDelta -= quantity;
        }

        await this.syncSingleWarehouseInventoryForOrderAction({
          productId: product._id,
          variantSku,
          availableAfterAction: Number(variant.stock || 0),
          quantity,
          action,
          session,
        });
      }

      const currentReserved = Number(product.inventorySummary?.reserved || 0);
      const nextReserved = currentReserved + reservedDelta;
      if (nextReserved < 0) {
        throw new AppError("Inventory reserved underflow", 409);
      }

      const available = (product.variants || []).reduce(
        (sum, variant) => sum + Math.max(0, Number(variant.stock || 0)),
        0,
      );
      product.inventorySummary = {
        total: available + nextReserved,
        available,
        reserved: nextReserved,
      };

      if (product.status === "active" && available <= 0) {
        product.status = "out_of_stock";
      } else if (product.status === "out_of_stock" && available > 0) {
        product.status = "active";
      }

      if (soldDelta !== 0) {
        product.totalSold = Math.max(0, Number(product.totalSold || 0) + soldDelta);
      }

      product.updatedAt = new Date();
      await product.save({ session });
    }
  }

  async syncSingleWarehouseInventoryForOrderAction(payload = {}) {
    const {
      productId,
      variantSku,
      availableAfterAction,
      quantity,
      action,
      session,
    } = payload;

    const safeQuantity = Math.max(0, Number(quantity || 0));
    const available = Math.max(0, Number(availableAfterAction || 0));

    let inventory = await Inventory.findOne({
      productId,
      variantSku,
      warehouseId: SINGLE_WAREHOUSE_ID,
    }).session(session);

    if (!inventory) {
      let initialReserved = 0;
      if (action === "reserve" || action === "commit") {
        initialReserved = safeQuantity;
      }

      inventory = new Inventory({
        productId,
        variantSku,
        warehouseId: SINGLE_WAREHOUSE_ID,
        warehouseName: SINGLE_WAREHOUSE_NAME,
        onHand: available + initialReserved,
        reserved: initialReserved,
        available,
        incoming: 0,
        lowStockAlert: false,
        updatedAt: new Date(),
      });
    }

    if (action === "reserve") {
      inventory.reserved = Math.max(0, Number(inventory.reserved || 0) + safeQuantity);
    } else if (action === "release" || action === "commit") {
      inventory.reserved = Math.max(0, Number(inventory.reserved || 0) - safeQuantity);
    }

    inventory.available = available;
    inventory.onHand = Math.max(0, inventory.available + Number(inventory.reserved || 0));
    inventory.lowStockAlert =
      inventory.reorderPoint !== undefined &&
      inventory.reorderPoint !== null &&
      inventory.available <= Number(inventory.reorderPoint || 0);
    inventory.updatedAt = new Date();

    await inventory.save({ session });
  }

  resolveShippingCarrier(data = {}) {
    const rawCarrier = (data.shippingCarrier || "").toString().trim();
    if (rawCarrier) {
      return rawCarrier;
    }
    return data.shippingMethod === "same_day" ? "Ahamove" : "GHN";
  }

  shouldUseGhnShipping(shippingMethod = "", shippingCarrier = "") {
    const carrier = (shippingCarrier || "").toString().trim().toUpperCase();
    return carrier === "GHN" && shippingMethod !== "same_day";
  }

  extractGhnAddressCodes(shippingAddress = {}) {
    const districtId = Number(
      shippingAddress?.districtId ||
        shippingAddress?.recipientDistrictId ||
        shippingAddress?.ghnDistrictId ||
        0,
    );
    const wardCode = (
      shippingAddress?.wardCode ||
      shippingAddress?.recipientWardCode ||
      shippingAddress?.ghnWardCode ||
      ""
    )
      .toString()
      .trim();

    if (!districtId || !wardCode) {
      throw new AppError(
        "Shipping address is missing GHN districtId/wardCode. Please select district and ward from GHN.",
        400,
      );
    }

    return { districtId, wardCode };
  }

  buildPackageProfileFromItems(items = []) {
    const base = { weight: 0, length: 0, width: 0, height: 0 };

    const profile = (items || []).reduce((acc, item) => {
      const quantity = Math.max(1, Number(item.quantity || 0));
      const unitWeight = Math.max(100, Number(item.packageWeightGr || 300));
      const unitLength = Math.max(10, Number(item.packageLengthCm || 20));
      const unitWidth = Math.max(10, Number(item.packageWidthCm || 15));
      const unitHeight = Math.max(1, Number(item.packageHeightCm || 4));

      acc.weight += unitWeight * quantity;
      acc.length = Math.max(acc.length, unitLength);
      acc.width = Math.max(acc.width, unitWidth);
      acc.height += unitHeight * quantity;
      return acc;
    }, base);

    if (!profile.weight) {
      profile.weight = 300;
      profile.length = 20;
      profile.width = 15;
      profile.height = 5;
    }

    profile.weight = Math.min(50000, Math.max(100, Math.round(profile.weight)));
    profile.length = Math.min(200, Math.max(10, Math.round(profile.length)));
    profile.width = Math.min(200, Math.max(10, Math.round(profile.width)));
    profile.height = Math.min(200, Math.max(1, Math.round(profile.height)));

    return profile;
  }

  async resolveGhnShippingFee(payload = {}) {
    const { items = [], shippingAddress = {}, shippingMethod = "standard" } = payload;
    const { districtId, wardCode } = this.extractGhnAddressCodes(shippingAddress);
    const packageProfile = this.buildPackageProfileFromItems(items);
    const insuranceValue = items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);

    const fee = await GHNShippingService.calculateFee({
      toDistrictId: districtId,
      toWardCode: wardCode,
      shippingMethod,
      insuranceValue,
      packageProfile,
    });

    return Number(fee.totalFee || 0);
  }

  buildShipmentAddressLine(shippingAddress = {}) {
    const parts = [
      shippingAddress?.line1,
      shippingAddress?.wardName,
      shippingAddress?.districtName || shippingAddress?.district,
      shippingAddress?.provinceName || shippingAddress?.city,
      shippingAddress?.country,
    ]
      .map((value) => (value || "").toString().trim())
      .filter(Boolean);

    return parts.join(", ");
  }

  buildGhnShipmentItems(orderItems = []) {
    return (orderItems || []).map((item) => ({
      name: (item.productName || "San pham").toString().trim(),
      code: (item.variantSku || "").toString().trim(),
      quantity: Math.max(1, Number(item.quantity || 1)),
      price: Math.max(0, Number(item.unitPrice || 0)),
      weight: Math.max(100, Number(item.packageWeightGr || 300)),
    }));
  }

  async createGhnShipmentForOrder(order, { session, note = "" } = {}) {
    if (!order) {
      throw new AppError("Order not found for GHN shipment creation", 404);
    }

    const shippingAddress = order.shippingAddress || {};
    const { districtId, wardCode } = this.extractGhnAddressCodes(shippingAddress);
    const packageProfile = this.buildPackageProfileFromItems(order.items || []);
    const codAmount = order.paymentMethod === "cod" ? Number(order.pricing?.total || 0) : 0;
    const recipientName = (order.customerSnapshot?.name || "").toString().trim();
    const recipientPhone = (order.customerSnapshot?.phone || "").toString().trim();

    if (!recipientName || !recipientPhone) {
      throw new AppError("Cannot create GHN shipment: missing recipient name or phone", 400);
    }

    const created = await GHNShippingService.createShipment({
      recipientName,
      recipientPhone,
      recipientAddress: this.buildShipmentAddressLine(shippingAddress),
      recipientDistrictId: districtId,
      recipientWardCode: wardCode,
      shippingMethod: order.shippingMethod || "standard",
      codAmount,
      insuranceValue: Math.max(0, Number(order.pricing?.total || 0)),
      content: `RioShop order ${order.orderNumber || order._id.toString()}`,
      note,
      clientOrderCode: order.orderNumber || "",
      items: this.buildGhnShipmentItems(order.items || []),
      ...packageProfile,
    });

    const ghnData = created?.data || {};
    const trackingCode =
      ghnData.order_code ||
      ghnData.orderCode ||
      ghnData.order_code_out ||
      ghnData.client_order_code ||
      "";

    if (!trackingCode) {
      throw new AppError("GHN did not return tracking code for shipment", 502);
    }

    const trackingBase = (
      process.env.GHN_TRACKING_BASE_URL || "https://donhang.ghn.vn/?order_code="
    ).trim();
    const trackingUrl = `${trackingBase}${encodeURIComponent(trackingCode)}`;
    const estimatedDeliveryRaw =
      ghnData.expected_delivery_time || ghnData.leadtime_order?.to_estimate_date || null;
    const estimatedDelivery = estimatedDeliveryRaw ? new Date(estimatedDeliveryRaw) : null;

    const shipmentDoc = new Shipment({
      orderId: order._id,
      carrier: "GHN",
      trackingCode,
      trackingUrl,
      status: "ready",
      events: [
        {
          status: "ready",
          location: "",
          note: "Shipment created on GHN",
          at: new Date(),
        },
      ],
      estimatedDelivery:
        estimatedDelivery && !Number.isNaN(estimatedDelivery.getTime())
          ? estimatedDelivery
          : null,
      recipientName: order.customerSnapshot?.name || "",
      recipientPhone: order.customerSnapshot?.phone || "",
      shippingAddress,
      weight: packageProfile.weight,
      codAmount,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await shipmentDoc.save({ session });
    return shipmentDoc;
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

  async generateOrderNumber(session = null) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const now = new Date();
      const datePart = now.toISOString().slice(2, 10).replace(/-/g, "");
      const randomPart = Math.floor(Math.random() * 900000 + 100000);
      const orderNumber = `RS${datePart}${randomPart}`;

      const query = Order.exists({ orderNumber });
      if (session) {
        query.session(session);
      }
      const exists = await query;
      if (!exists) {
        return orderNumber;
      }
    }

    throw new AppError("Failed to generate order number", 500);
  }
}

export default new OrderService();
