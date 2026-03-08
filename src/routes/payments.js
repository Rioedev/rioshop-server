import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validation.js";
import {
  createPayment,
  getPaymentStatus,
  paymentWebhook,
} from "../controllers/paymentController.js";
import {
  createPaymentValidation,
  paymentIdValidation,
  paymentWebhookValidation,
} from "../validations/payments.js";

const router = express.Router();

// Create payment
router.post(
  "/",
  authenticateToken,
  validateRequest(createPaymentValidation),
  createPayment,
);

// Get payment status
router.get("/:id", authenticateToken, validateRequest(paymentIdValidation), getPaymentStatus);

// Payment webhook
router.post(
  "/webhook/:provider",
  validateRequest(paymentWebhookValidation),
  paymentWebhook,
);

export default router;
