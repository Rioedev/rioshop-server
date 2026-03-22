import { asyncHandler, sendError, sendSuccess } from "../utils/helpers.js";
import paymentRecordService from "../services/paymentRecordService.js";

export const createPayment = asyncHandler(async (req, res) => {
  const serverBaseUrl = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get("host")}`;
  const clientBaseUrl =
    process.env.STOREFRONT_URL ||
    req.headers.origin ||
    process.env.CORS_ORIGIN?.split(",")[0]?.trim() ||
    serverBaseUrl;

  const method = req.body.method || "momo";
  const defaultReturnUrl = `${clientBaseUrl}/payment/momo-return`;
  const defaultIpnUrl = `${serverBaseUrl}/api/payments/webhook/${method}`;

  const result = await paymentRecordService.initiatePayment({
    ...req.body,
    method,
    userId: req.user.userId,
    ipAddress: req.ip,
    returnUrl: req.body.returnUrl || defaultReturnUrl,
    ipnUrl: req.body.ipnUrl || defaultIpnUrl,
  });

  sendSuccess(res, 201, result, "Payment initiated");
});

export const getPaymentStatus = asyncHandler(async (req, res) => {
  const payment = await paymentRecordService.getPaymentById(
    req.params.id,
    req.user.adminId ? null : req.user.userId,
  );

  if (!payment) {
    return sendError(res, 404, "Payment not found");
  }

  sendSuccess(res, 200, payment, "Payment status retrieved");
});

export const paymentWebhook = asyncHandler(async (req, res) => {
  const payment = await paymentRecordService.processWebhook(
    req.params.provider,
    req.body,
  );

  sendSuccess(res, 200, payment, "Webhook processed");
});
