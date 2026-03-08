import express from "express";
import { validateRequest } from "../middlewares/validation.js";
import {
  getShipment,
  updateTracking,
  shipmentWebhook,
} from "../controllers/shipmentController.js";
import {
  shipmentIdValidation,
  updateTrackingValidation,
  shipmentWebhookValidation,
} from "../validations/shipments.js";

const router = express.Router();

// Get shipment
router.get("/:id", validateRequest(shipmentIdValidation), getShipment);

// Update tracking
router.put("/:id/tracking", validateRequest(updateTrackingValidation), updateTracking);

// Shipment webhook
router.post(
  "/webhook/:carrier",
  validateRequest(shipmentWebhookValidation),
  shipmentWebhook,
);

export default router;
