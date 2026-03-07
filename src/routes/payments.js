import express from "express";
import { asyncHandler, sendSuccess } from "../utils/helpers.js";

const router = express.Router();

// Create payment
router.post(
  "/",
  asyncHandler(async (req, res) => {
    sendSuccess(res, 201, {}, "Payment initiated");
  }),
);

// Get payment status
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Payment status retrieved");
  }),
);

// Payment webhook
router.post(
  "/webhook/:provider",
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Webhook processed");
  }),
);

export default router;
