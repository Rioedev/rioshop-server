import { asyncHandler, sendError, sendSuccess } from "../utils/helpers.js";
import shipmentService from "../services/shipmentService.js";

export const getShipment = asyncHandler(async (req, res) => {
  const shipment = await shipmentService.getShipmentById(req.params.id);

  if (!shipment) {
    return sendError(res, 404, "Shipment not found");
  }

  sendSuccess(res, 200, shipment, "Shipment retrieved");
});

export const updateTracking = asyncHandler(async (req, res) => {
  const shipment = await shipmentService.updateTracking(req.params.id, req.body);
  sendSuccess(res, 200, shipment, "Tracking updated");
});

export const shipmentWebhook = asyncHandler(async (req, res) => {
  const shipment = await shipmentService.processWebhook(req.params.carrier, req.body);
  sendSuccess(res, 200, shipment, "Webhook processed");
});
