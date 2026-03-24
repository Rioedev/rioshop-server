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

export const calculateGhnFee = asyncHandler(async (req, res) => {
  const fee = await GHNShippingService.calculateFee(req.body);
  sendSuccess(res, 200, fee, "GHN shipping fee calculated");
});
