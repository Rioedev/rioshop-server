import { asyncHandler, sendError, sendSuccess } from "../utils/helpers.js";
import shipmentService from "../services/shipmentService.js";
import { GHNShippingService } from "../services/shippingService.js";

export const getShipment = asyncHandler(async (req, res) => {
  const shipment = await shipmentService.getShipmentById(req.params.id);

  if (!shipment) {
    return sendError(res, 404, "Shipment not found");
  }

  sendSuccess(res, 200, shipment, "Shipment retrieved");
});

export const updateTracking = asyncHandler(async (req, res) => {
  if (!req.user?.adminId) {
    return sendError(res, 403, "Only admin can update shipment tracking");
  }
  const shipment = await shipmentService.updateTracking(req.params.id, req.body);
  sendSuccess(res, 200, shipment, "Tracking updated");
});

export const syncShipmentFromGhn = asyncHandler(async (req, res) => {
  if (!req.user?.adminId) {
    return sendError(res, 403, "Only admin can sync GHN shipment");
  }

  const result = await shipmentService.syncGhnShipmentById(req.params.id);
  sendSuccess(res, 200, result, "GHN shipment synced");
});

export const syncActiveGhnShipments = asyncHandler(async (req, res) => {
  if (!req.user?.adminId) {
    return sendError(res, 403, "Only admin can sync GHN shipments");
  }

  const result = await shipmentService.syncActiveGhnShipments({
    limit: req.body?.limit,
  });
  sendSuccess(res, 200, result, "Active GHN shipments synced");
});

export const shipmentWebhook = asyncHandler(async (req, res) => {
  const shipment = await shipmentService.processWebhook(req.params.carrier, req.body);
  sendSuccess(res, 200, shipment, "Webhook processed");
});

export const getGhnProvinces = asyncHandler(async (req, res) => {
  const provinces = await GHNShippingService.getProvinces();
  sendSuccess(res, 200, provinces, "GHN provinces retrieved");
});

export const getGhnDistricts = asyncHandler(async (req, res) => {
  const districts = await GHNShippingService.getDistricts(req.query.provinceId);
  sendSuccess(res, 200, districts, "GHN districts retrieved");
});

export const getGhnWards = asyncHandler(async (req, res) => {
  const wards = await GHNShippingService.getWards(req.query.districtId);
  sendSuccess(res, 200, wards, "GHN wards retrieved");
});

export const getShippingPolicy = asyncHandler(async (req, res) => {
  const policy = GHNShippingService.getShippingPolicy();
  sendSuccess(res, 200, policy, "Shipping policy retrieved");
});

export const calculateGhnFee = asyncHandler(async (req, res) => {
  const fee = await GHNShippingService.calculateFee(req.body);
  const quote = GHNShippingService.buildFeeQuote(fee, req.body);
  sendSuccess(res, 200, quote, "GHN shipping fee calculated");
});
