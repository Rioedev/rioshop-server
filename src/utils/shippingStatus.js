const normalizeStatusToken = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const CARRIER_TO_INTERNAL_STATUS = {
  ready: "ready",
  created: "ready",
  ready_to_pick: "ready",
  picking: "ready",
  money_collect_picking: "ready",
  picked: "picked_up",
  picked_up: "picked_up",
  pickup: "picked_up",
  storing: "in_transit",
  sorting: "in_transit",
  transporting: "in_transit",
  in_transit: "in_transit",
  delivering: "out_for_delivery",
  money_collect_delivering: "out_for_delivery",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  waiting_to_return: "failed",
  return: "failed",
  return_transporting: "failed",
  return_sorting: "failed",
  returning: "failed",
  returned: "returned",
  delivery_fail: "failed",
  return_fail: "failed",
  failed: "failed",
  cancel: "failed",
  cancelled: "failed",
  exception: "failed",
  damage: "failed",
  lost: "failed",
};

const INTERNAL_TO_CARRIER_STATUS = {
  ready: "ready_to_pick",
  picked_up: "picked",
  in_transit: "transporting",
  out_for_delivery: "delivering",
  delivered: "delivered",
  failed: "delivery_fail",
  returned: "returned",
};

const WAITING_PICKUP_CARRIER_STATUSES = new Set([
  "ready_to_pick",
  "picking",
  "money_collect_picking",
]);
const IN_TRANSIT_CARRIER_STATUSES = new Set(["picked", "storing", "sorting", "transporting"]);
const OUT_FOR_DELIVERY_CARRIER_STATUSES = new Set(["delivering", "money_collect_delivering"]);
const RETURN_IN_PROGRESS_CARRIER_STATUSES = new Set([
  "waiting_to_return",
  "return",
  "return_transporting",
  "return_sorting",
  "returning",
]);
const ISSUE_CARRIER_STATUSES = new Set([
  "delivery_fail",
  "return_fail",
  "exception",
  "damage",
  "lost",
  "cancel",
  "cancelled",
]);

export const normalizeCarrierStatusToken = (value = "") => normalizeStatusToken(value);

export const mapCarrierToInternalStatus = (rawStatus = "", carrier = "") => {
  const status = normalizeCarrierStatusToken(rawStatus);
  if (!status) {
    return null;
  }

  if (CARRIER_TO_INTERNAL_STATUS[status]) {
    return CARRIER_TO_INTERNAL_STATUS[status];
  }

  const normalizedCarrier = normalizeStatusToken(carrier);
  if (normalizedCarrier === "ghn") {
    if (status.includes("return")) {
      return "failed";
    }
    if (status.includes("deliver")) {
      return "out_for_delivery";
    }
  }

  return null;
};

export const mapInternalToCarrierStatus = (internalStatus = "") => {
  const status = normalizeStatusToken(internalStatus);
  return INTERNAL_TO_CARRIER_STATUS[status] || "";
};

export const resolveCarrierStatusForOrder = (order = {}) => {
  const shipment = order?.shipmentId;
  if (!shipment || typeof shipment !== "object") {
    return "";
  }

  const carrierStatus = normalizeCarrierStatusToken(shipment.carrierStatus || "");
  if (carrierStatus) {
    return carrierStatus;
  }

  return mapInternalToCarrierStatus(shipment.status || "");
};

export const resolveCustomerStatus = ({
  orderStatus = "",
  carrierStatus = "",
  returnRequestStatus = "",
} = {}) => {
  const normalizedOrderStatus = normalizeStatusToken(orderStatus);
  const normalizedCarrierStatus = normalizeCarrierStatusToken(carrierStatus);
  const normalizedReturnRequestStatus = normalizeStatusToken(returnRequestStatus);

  if (normalizedOrderStatus === "cancelled") {
    return "cancelled";
  }

  if (normalizedCarrierStatus === "returned" || normalizedOrderStatus === "returned") {
    return "returned";
  }

  if (normalizedReturnRequestStatus === "pending" || normalizedReturnRequestStatus === "approved") {
    return "return_in_progress";
  }

  if (normalizedOrderStatus === "completed") {
    return "completed";
  }

  if (normalizedOrderStatus === "confirmed") {
    return "confirmed";
  }

  if (normalizedOrderStatus === "packing") {
    return "packing";
  }

  if (RETURN_IN_PROGRESS_CARRIER_STATUSES.has(normalizedCarrierStatus)) {
    return "return_in_progress";
  }

  if (ISSUE_CARRIER_STATUSES.has(normalizedCarrierStatus)) {
    return "issue";
  }

  if (normalizedCarrierStatus === "delivered" || normalizedOrderStatus === "delivered") {
    return "delivered";
  }

  if (OUT_FOR_DELIVERY_CARRIER_STATUSES.has(normalizedCarrierStatus)) {
    return "out_for_delivery";
  }

  if (
    IN_TRANSIT_CARRIER_STATUSES.has(normalizedCarrierStatus) ||
    normalizedOrderStatus === "shipping"
  ) {
    return "in_transit";
  }

  if (
    normalizedOrderStatus === "ready_to_ship" ||
    WAITING_PICKUP_CARRIER_STATUSES.has(normalizedCarrierStatus)
  ) {
    return "waiting_pickup";
  }

  return "pending_confirmation";
};
