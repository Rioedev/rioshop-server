import express from "express";
import multer from "multer";
import { authenticateToken } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validation.js";
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  submitReturnRequest,
  updateReturnRequestStatus,
  uploadReturnRequestImage,
} from "../controllers/orderController.js";
import {
  getOrdersValidation,
  orderIdValidation,
  createOrderValidation,
  updateOrderStatusValidation,
  cancelOrderValidation,
  submitReturnRequestValidation,
  updateReturnRequestStatusValidation,
} from "../validations/orders.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

// Get all orders
router.get("/", authenticateToken, validateRequest(getOrdersValidation), getOrders);

// Get order by ID
router.get("/:id", authenticateToken, validateRequest(orderIdValidation), getOrderById);

// Create order
router.post("/", authenticateToken, validateRequest(createOrderValidation), createOrder);

// Upload return/exchange proof image
router.post(
  "/upload-return-image",
  authenticateToken,
  upload.single("file"),
  uploadReturnRequestImage,
);

// Update order status
router.patch(
  "/:id/status",
  authenticateToken,
  validateRequest(updateOrderStatusValidation),
  updateOrderStatus,
);

// Cancel order
router.post(
  "/:id/cancel",
  authenticateToken,
  validateRequest(cancelOrderValidation),
  cancelOrder,
);

// Submit return/exchange request
router.post(
  "/:id/return-request",
  authenticateToken,
  validateRequest(submitReturnRequestValidation),
  submitReturnRequest,
);

router.patch(
  "/:id/return-request/status",
  authenticateToken,
  validateRequest(updateReturnRequestStatusValidation),
  updateReturnRequestStatus,
);

export default router;
