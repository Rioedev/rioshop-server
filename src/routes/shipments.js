import express from "express";
import { asyncHandler, sendSuccess } from "../utils/helpers.js";

const router = express.Router();

// Get shipment
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Shipment retrieved");
  }),
);

// Update tracking
router.put(
  "/:id/tracking",
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Tracking updated");
  }),
);

// Shipment webhook
router.post(
  "/webhook/:carrier",
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Webhook processed");
  }),
);

export default router;
