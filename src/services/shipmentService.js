import Shipment from "../models/Shipment.js";
import Order from "../models/Order.js";
import orderService from "./orderService.js";
import { AppError } from "../utils/helpers.js";

const SHIPMENT_TO_ORDER_STATUS = {
  ready: "ready_to_ship",
  picked_up: "shipping",
  in_transit: "shipping",
  out_for_delivery: "shipping",
  delivered: "delivered",
  failed: "returned",
  returned: "returned",
};

export class ShipmentService {
  async getShipmentById(id) {
    try {
      return await Shipment.findById(id).populate([{ path: "orderId" }]);
    } catch (error) {
      throw error;
    }
  }

  async getShipmentByTrackingCode(trackingCode) {
    try {
      return await Shipment.findOne({ trackingCode }).populate([{ path: "orderId" }]);
    } catch (error) {
      throw error;
    }
  }

  async createShipment(data) {
    try {
      const order = await Order.findById(data.orderId);
      if (!order) {
        throw new AppError("Order not found", 404);
      }

      const shipment = new Shipment({
        ...data,
        status: data.status || "ready",
        events: [
          {
            status: data.status || "ready",
            location: data.initialLocation || "",
            note: data.initialNote || "Shipment created",
            at: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await shipment.save();

      await Order.findByIdAndUpdate(order._id, {
        shipmentId: shipment._id,
        shippingCarrier: shipment.carrier,
        updatedAt: new Date(),
      });

      const mappedOrderStatus = SHIPMENT_TO_ORDER_STATUS[shipment.status];
      if (mappedOrderStatus && mappedOrderStatus !== order.status) {
        await orderService.updateOrderStatus(order._id, mappedOrderStatus, {
          note: data.initialNote || "Shipment created",
          updatedBy: "system",
        });
      }

      return shipment;
    } catch (error) {
      throw error;
    }
  }

  async updateTracking(shipmentId, data = {}) {
    try {
      const shipment = await Shipment.findById(shipmentId);
      if (!shipment) {
        throw new AppError("Shipment not found", 404);
      }

      const previousStatus = shipment.status;

      if (data.status) shipment.status = data.status;
      if (data.trackingCode) shipment.trackingCode = data.trackingCode;
      if (data.trackingUrl !== undefined) shipment.trackingUrl = data.trackingUrl;
      if (data.estimatedDelivery !== undefined) {
        shipment.estimatedDelivery = data.estimatedDelivery
          ? new Date(data.estimatedDelivery)
          : null;
      }
      if (data.shippingAddress !== undefined) shipment.shippingAddress = data.shippingAddress;
      if (data.recipientName !== undefined) shipment.recipientName = data.recipientName;
      if (data.recipientPhone !== undefined) shipment.recipientPhone = data.recipientPhone;
      if (data.weight !== undefined) shipment.weight = Number(data.weight);
      if (data.codAmount !== undefined) shipment.codAmount = Number(data.codAmount);

      if (
        data.status &&
        (data.status !== previousStatus || data.location || data.note)
      ) {
        shipment.events = shipment.events || [];
        shipment.events.push({
          status: data.status,
          location: data.location || "",
          note: data.note || "",
          at: data.eventAt ? new Date(data.eventAt) : new Date(),
        });
      }

      if (data.status === "delivered") {
        shipment.deliveredAt = data.eventAt ? new Date(data.eventAt) : new Date();
      }

      shipment.updatedAt = new Date();
      await shipment.save();

      if (shipment.orderId) {
        const mappedOrderStatus = SHIPMENT_TO_ORDER_STATUS[shipment.status];
        if (mappedOrderStatus) {
          const order = await Order.findById(shipment.orderId).select("_id status");
          if (order && order.status !== mappedOrderStatus) {
            await orderService.updateOrderStatus(order._id, mappedOrderStatus, {
              note: data.note || "",
              updatedBy: "system",
            });
          }
        }
      }

      return shipment;
    } catch (error) {
      throw error;
    }
  }

  async processWebhook(carrier, payload = {}) {
    try {
      const trackingCode =
        payload.trackingCode ||
        payload.order_code ||
        payload.orderCode ||
        payload.label_id ||
        payload.shipment_code;

      if (!trackingCode) {
        throw new AppError("Tracking code is missing in webhook payload", 400);
      }

      const shipment = await Shipment.findOne({ trackingCode });
      if (!shipment) {
        throw new AppError("Shipment not found", 404);
      }

      const normalizedStatus = this.normalizeCarrierStatus(
        carrier,
        payload.status || payload.statusCode || payload.state,
      );

      return await this.updateTracking(shipment._id, {
        status: normalizedStatus || shipment.status,
        location: payload.location || payload.current_location || "",
        note: payload.note || payload.description || "",
        eventAt: payload.updatedAt || payload.time || new Date(),
      });
    } catch (error) {
      throw error;
    }
  }

  normalizeCarrierStatus(carrier, rawStatus) {
    const status = (rawStatus || "").toString().toLowerCase();

    const map = {
      ready: "ready",
      created: "ready",
      picked_up: "picked_up",
      pickup: "picked_up",
      in_transit: "in_transit",
      transporting: "in_transit",
      out_for_delivery: "out_for_delivery",
      delivering: "out_for_delivery",
      delivered: "delivered",
      failed: "failed",
      cancelled: "failed",
      returned: "returned",
    };

    if (map[status]) {
      return map[status];
    }

    // Carrier-specific fallback handling
    if (carrier === "GHN" && status.includes("delivery")) {
      return "out_for_delivery";
    }

    return null;
  }
}

export default new ShipmentService();
