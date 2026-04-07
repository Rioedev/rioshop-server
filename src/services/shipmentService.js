import Shipment from "../models/Shipment.js";
import Order from "../models/Order.js";
import orderService from "./orderService.js";
import { AppError } from "../utils/helpers.js";
import { GHNShippingService } from "./shippingService.js";
import {
  mapCarrierToInternalStatus,
  mapInternalToCarrierStatus,
  normalizeCarrierStatusToken,
} from "../utils/shippingStatus.js";

const SHIPMENT_TO_ORDER_STATUS = {
  ready: "ready_to_ship",
  picked_up: "shipping",
  in_transit: "shipping",
  out_for_delivery: "shipping",
  delivered: "delivered",
  returned: "returned",
};
const ACTIVE_SHIPMENT_STATUSES = new Set([
  "ready",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "failed",
]);
const clampSyncLimit = (value, fallback = 20) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(100, Math.max(1, Math.round(parsed)));
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

      const carrierStatus = normalizeCarrierStatusToken(data.carrierStatus || "");
      const internalStatus =
        data.status ||
        mapCarrierToInternalStatus(carrierStatus, data.carrier || "") ||
        "ready";
      const fallbackCarrierStatus =
        carrierStatus || mapInternalToCarrierStatus(internalStatus);

      const shipment = new Shipment({
        ...data,
        status: internalStatus,
        carrierStatus: fallbackCarrierStatus || undefined,
        events: [
          {
            status: internalStatus,
            carrierStatus: fallbackCarrierStatus || "",
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

      const mappedOrderStatus = SHIPMENT_TO_ORDER_STATUS[internalStatus];
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
      const previousCarrierStatus = normalizeCarrierStatusToken(shipment.carrierStatus || "");
      const incomingCarrierStatus = normalizeCarrierStatusToken(data.carrierStatus || "");
      const derivedStatus = mapCarrierToInternalStatus(
        incomingCarrierStatus,
        shipment.carrier || "",
      );
      const nextStatus = data.status || derivedStatus || shipment.status;
      const nextCarrierStatus =
        incomingCarrierStatus ||
        previousCarrierStatus ||
        mapInternalToCarrierStatus(nextStatus);

      if (nextStatus) shipment.status = nextStatus;
      if (nextCarrierStatus) {
        shipment.carrierStatus = nextCarrierStatus;
      }
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
        nextStatus !== previousStatus ||
        nextCarrierStatus !== previousCarrierStatus ||
        data.location ||
        data.note
      ) {
        shipment.events = shipment.events || [];
        shipment.events.push({
          status: nextStatus,
          carrierStatus: nextCarrierStatus || "",
          location: data.location || "",
          note: data.note || "",
          at: data.eventAt ? new Date(data.eventAt) : new Date(),
        });
      }

      if (nextStatus === "delivered") {
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
      const carrierStatus = normalizeCarrierStatusToken(
        payload.status || payload.statusCode || payload.state,
      );

      return await this.updateTracking(shipment._id, {
        status: normalizedStatus || shipment.status,
        carrierStatus: carrierStatus || shipment.carrierStatus || "",
        location: payload.location || payload.current_location || "",
        note: payload.note || payload.description || "",
        eventAt: payload.updatedAt || payload.time || new Date(),
      });
    } catch (error) {
      throw error;
    }
  }

  extractGhnTrackingState(payload = {}) {
    const data = payload?.data || payload || {};
    const rawStatusCandidates = [
      data.status,
      data.state,
      data.current_status,
      data.order_status,
      payload.status,
      payload.state,
    ];
    const rawCarrierStatus = rawStatusCandidates.find((value) => value !== undefined && value !== null);
    const carrierStatus = normalizeCarrierStatusToken(rawCarrierStatus || "");
    const internalStatus = mapCarrierToInternalStatus(carrierStatus, "GHN");

    const timelineCandidates = [
      data.log,
      data.logs,
      data.status_history,
      data.statusHistory,
      data.timeline,
      data.tracking_logs,
      data.trackingLogs,
    ];
    const events = timelineCandidates.find((value) => Array.isArray(value)) || [];
    const latestEvent = events.length > 0 ? events[events.length - 1] : null;

    const eventTime =
      latestEvent?.updated_at ||
      latestEvent?.updatedAt ||
      latestEvent?.time ||
      latestEvent?.action_time ||
      latestEvent?.created_at ||
      data.updated_at ||
      data.updatedAt ||
      data.current_time ||
      null;

    return {
      carrierStatus,
      internalStatus,
      eventAt: eventTime || null,
      location:
        latestEvent?.location ||
        latestEvent?.hub_name ||
        latestEvent?.area ||
        data.current_location ||
        "",
      note:
        latestEvent?.description ||
        latestEvent?.note ||
        latestEvent?.action ||
        latestEvent?.status_name ||
        "",
    };
  }

  async syncGhnShipmentById(shipmentId) {
    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) {
      throw new AppError("Shipment not found", 404);
    }

    if ((shipment.carrier || "").toString().trim().toUpperCase() !== "GHN") {
      throw new AppError("Only GHN shipment can be synced", 400);
    }

    if (!shipment.trackingCode) {
      throw new AppError("Shipment tracking code is missing", 400);
    }

    GHNShippingService.assertConfigured();
    const detail = await GHNShippingService.trackShipment(shipment.trackingCode);
    const resolved = this.extractGhnTrackingState(detail);

    if (!resolved.internalStatus && !resolved.carrierStatus) {
      return {
        updated: false,
        reason: "missing_status_from_ghn",
        trackingCode: shipment.trackingCode,
      };
    }

    const nextStatus = resolved.internalStatus || shipment.status;
    const nextCarrierStatus = resolved.carrierStatus || shipment.carrierStatus || "";
    const hasStatusChanged = nextStatus !== shipment.status;
    const hasCarrierStatusChanged =
      normalizeCarrierStatusToken(nextCarrierStatus) !==
      normalizeCarrierStatusToken(shipment.carrierStatus || "");

    if (!hasStatusChanged && !hasCarrierStatusChanged) {
      return {
        updated: false,
        reason: "status_unchanged",
        trackingCode: shipment.trackingCode,
        shipmentStatus: shipment.status,
        carrierStatus: shipment.carrierStatus || "",
      };
    }

    const updated = await this.updateTracking(shipment._id, {
      status: nextStatus,
      carrierStatus: nextCarrierStatus,
      location: resolved.location || "",
      note: "",
      eventAt: resolved.eventAt || new Date().toISOString(),
    });

    return {
      updated: true,
      trackingCode: shipment.trackingCode,
      shipmentStatus: updated.status,
      carrierStatus: updated.carrierStatus || "",
    };
  }

  async syncActiveGhnShipments(options = {}) {
    const limit = clampSyncLimit(options.limit, 20);
    const targets = await Shipment.find({
      carrier: "GHN",
      trackingCode: { $exists: true, $ne: "" },
      status: { $in: Array.from(ACTIVE_SHIPMENT_STATUSES) },
    })
      .sort({ updatedAt: 1 })
      .limit(limit)
      .select("_id trackingCode status carrierStatus updatedAt");

    const result = {
      total: targets.length,
      updated: 0,
      unchanged: 0,
      failed: 0,
      items: [],
    };

    for (const target of targets) {
      try {
        const synced = await this.syncGhnShipmentById(target._id);
        if (synced.updated) {
          result.updated += 1;
        } else {
          result.unchanged += 1;
        }
        result.items.push({
          shipmentId: target._id.toString(),
          trackingCode: target.trackingCode,
          ...synced,
        });
      } catch (error) {
        result.failed += 1;
        result.items.push({
          shipmentId: target._id.toString(),
          trackingCode: target.trackingCode,
          updated: false,
          reason: "sync_error",
          error: error?.message || "Unknown sync error",
        });
      }
    }

    return result;
  }

  normalizeCarrierStatus(carrier, rawStatus) {
    return mapCarrierToInternalStatus(rawStatus, carrier);
  }
}

export default new ShipmentService();
