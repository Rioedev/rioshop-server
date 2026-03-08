import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import {
  MomoPaymentService,
  VNPaymentService,
  ZaloPaymentService,
} from "./paymentService.js";
import { AppError } from "../utils/helpers.js";

export class PaymentRecordService {
  async initiatePayment(data) {
    const { orderId, method, userId, amount, currency, ipAddress, returnUrl } = data;

    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new AppError("Order not found", 404);
      }

      const resolvedMethod = method || order.paymentMethod;
      const resolvedAmount = Number(amount ?? order.pricing?.total ?? 0);
      const resolvedCurrency = currency || order.pricing?.currency || "VND";

      if (!resolvedMethod) {
        throw new AppError("Payment method is required", 400);
      }

      if (!Number.isFinite(resolvedAmount) || resolvedAmount <= 0) {
        throw new AppError("Payment amount is invalid", 400);
      }

      const payment = new Payment({
        orderId,
        userId: userId || order.userId,
        method: resolvedMethod,
        amount: resolvedAmount,
        currency: resolvedCurrency,
        status: "pending",
        ipAddress,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await payment.save();

      let gatewayResponse = null;

      try {
        if (resolvedMethod === "momo") {
          gatewayResponse = await MomoPaymentService.createPayment(
            payment._id.toString(),
            resolvedAmount,
          );
        } else if (resolvedMethod === "vnpay") {
          gatewayResponse = await VNPaymentService.createPayment(
            payment._id.toString(),
            resolvedAmount,
            returnUrl,
          );
        } else if (resolvedMethod === "zalopay") {
          gatewayResponse = await ZaloPaymentService.createPayment(
            payment._id.toString(),
            resolvedAmount,
          );
        } else if (resolvedMethod === "cod" || resolvedMethod === "bank_transfer") {
          gatewayResponse = {
            message: "No online gateway required",
            method: resolvedMethod,
          };
        } else {
          throw new AppError("Unsupported payment method", 400);
        }
      } catch (error) {
        payment.status = "failed";
        payment.gatewayResponse = {
          error: error.message,
        };
        payment.updatedAt = new Date();
        await payment.save();
        throw error;
      }

      payment.gateway = this.resolveGatewayName(resolvedMethod);
      payment.gatewayTxId = this.extractGatewayTxId(gatewayResponse);
      payment.gatewayResponse = gatewayResponse;
      payment.updatedAt = new Date();
      await payment.save();

      order.paymentId = payment._id;
      order.paymentStatus = this.mapPaymentStatusToOrderStatus(payment.status);
      order.updatedAt = new Date();
      await order.save();

      return {
        payment,
        gatewayResponse,
      };
    } catch (error) {
      throw error;
    }
  }

  async getPaymentById(paymentId, userId = null) {
    try {
      const query = { _id: paymentId };
      if (userId) {
        query.userId = userId;
      }

      return await Payment.findOne(query).populate([{ path: "orderId" }]);
    } catch (error) {
      throw error;
    }
  }

  async getPaymentByOrderId(orderId) {
    try {
      return await Payment.findOne({ orderId }).sort({ createdAt: -1 });
    } catch (error) {
      throw error;
    }
  }

  async processWebhook(provider, payload = {}) {
    try {
      const normalizedProvider = (provider || "").toLowerCase();
      const payment = await this.findPaymentFromWebhookPayload(payload);

      if (!payment) {
        throw new AppError("Payment not found for webhook payload", 404);
      }

      const status = this.resolveWebhookStatus(normalizedProvider, payload);

      payment.status = status;
      payment.gateway = this.resolveGatewayName(normalizedProvider);
      payment.gatewayResponse = payload;
      payment.gatewayTxId = payment.gatewayTxId || this.extractGatewayTxId(payload);
      payment.updatedAt = new Date();

      if (status === "success") {
        payment.paidAt = new Date();
      }

      await payment.save();

      await Order.findByIdAndUpdate(payment.orderId, {
        paymentStatus: this.mapPaymentStatusToOrderStatus(status),
        updatedAt: new Date(),
      });

      return payment;
    } catch (error) {
      throw error;
    }
  }

  async refundPayment(paymentId, payload = {}) {
    const { amount, reason = "manual_refund", status = "pending", refundId = null } = payload;

    try {
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        throw new AppError("Payment not found", 404);
      }

      const refundAmount = Number(amount ?? payment.amount);
      if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
        throw new AppError("Refund amount is invalid", 400);
      }

      payment.refunds = payment.refunds || [];
      payment.refunds.push({
        amount: refundAmount,
        reason,
        status,
        processedAt: new Date(),
        refundId,
      });

      if (refundAmount >= payment.amount) {
        payment.status = "refunded";
      }
      payment.updatedAt = new Date();
      await payment.save();

      await Order.findByIdAndUpdate(payment.orderId, {
        paymentStatus: this.mapPaymentStatusToOrderStatus(payment.status),
        updatedAt: new Date(),
      });

      return payment;
    } catch (error) {
      throw error;
    }
  }

  async findPaymentFromWebhookPayload(payload) {
    const idCandidates = [
      payload.paymentId,
      payload.orderId,
      payload.order_id,
      payload.transId,
      payload.transactionId,
      payload.app_trans_id,
      payload.vnp_TxnRef,
      payload.gatewayTxId,
    ].filter(Boolean);

    for (const candidate of idCandidates) {
      const raw = candidate.toString();

      if (mongoose.Types.ObjectId.isValid(raw)) {
        const byId = await Payment.findById(raw);
        if (byId) {
          return byId;
        }

        const byOrder = await Payment.findOne({ orderId: raw }).sort({ createdAt: -1 });
        if (byOrder) {
          return byOrder;
        }
      }

      const byGatewayTxId = await Payment.findOne({ gatewayTxId: raw }).sort({
        createdAt: -1,
      });
      if (byGatewayTxId) {
        return byGatewayTxId;
      }
    }

    return null;
  }

  resolveWebhookStatus(provider, payload) {
    if (provider === "momo") {
      return Number(payload.resultCode) === 0 ? "success" : "failed";
    }

    if (provider === "vnpay") {
      return payload.vnp_ResponseCode === "00" ? "success" : "failed";
    }

    if (provider === "zalopay") {
      return Number(payload.return_code) === 1 ? "success" : "failed";
    }

    const rawStatus = (payload.status || payload.paymentStatus || "").toString().toLowerCase();

    if (["success", "succeeded", "paid"].includes(rawStatus)) {
      return "success";
    }

    if (["failed", "error", "cancelled"].includes(rawStatus)) {
      return "failed";
    }

    if (["refunded"].includes(rawStatus)) {
      return "refunded";
    }

    return "pending";
  }

  resolveGatewayName(method) {
    const map = {
      momo: "momo",
      vnpay: "vnpay",
      zalopay: "zalopay",
      cod: "cod",
      bank_transfer: "bank_transfer",
    };

    return map[method] || method || "unknown";
  }

  extractGatewayTxId(payload = {}) {
    return (
      payload.transId ||
      payload.transactionId ||
      payload.gatewayTxId ||
      payload.app_trans_id ||
      payload.vnp_TxnRef ||
      payload.orderId ||
      payload.order_id ||
      null
    );
  }

  mapPaymentStatusToOrderStatus(status) {
    if (status === "success") {
      return "paid";
    }

    if (status === "refunded") {
      return "refunded";
    }

    if (status === "failed") {
      return "failed";
    }

    return "pending";
  }
}

export default new PaymentRecordService();
