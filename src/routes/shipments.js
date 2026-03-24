import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validation.js";
import {
  calculateGhnFee,
  getGhnDistricts,
  getGhnProvinces,
  getGhnWards,
  getShipment,
  updateTracking,
  shipmentWebhook,
} from "../controllers/shipmentController.js";
import {
  ghnDistrictsValidation,
  ghnFeeValidation,
  ghnWardsValidation,
  shipmentIdValidation,
  updateTrackingValidation,
  shipmentWebhookValidation,
} from "../validations/shipments.js";

const router = express.Router();

// GHN master data + fee quote
router.get("/ghn/provinces", authenticateToken, getGhnProvinces);
router.get(
  "/ghn/districts",
  authenticateToken,
  validateRequest(ghnDistrictsValidation),
  getGhnDistricts,
);
router.get(
  "/ghn/wards",
  authenticateToken,
  validateRequest(ghnWardsValidation),
  getGhnWards,
);
router.post(
  "/ghn/fee",
  authenticateToken,
  validateRequest(ghnFeeValidation),
  calculateGhnFee,
);

// Get shipment
router.get("/:id", authenticateToken, validateRequest(shipmentIdValidation), getShipment);

// Update tracking
router.put(
  "/:id/tracking",
  authenticateToken,
  validateRequest(updateTrackingValidation),
  updateTracking,
);

// Shipment webhook
router.post(
  "/webhook/:carrier",
  validateRequest(shipmentWebhookValidation),
  shipmentWebhook,
);

export default router;
