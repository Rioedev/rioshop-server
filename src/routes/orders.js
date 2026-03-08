import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validation.js";
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  cancelOrder,
} from "../controllers/orderController.js";
import {
  getOrdersValidation,
  orderIdValidation,
  createOrderValidation,
  updateOrderStatusValidation,
  cancelOrderValidation,
} from "../validations/orders.js";

const router = express.Router();

// Get all orders
router.get("/", authenticateToken, validateRequest(getOrdersValidation), getOrders);

// Get order by ID
router.get("/:id", authenticateToken, validateRequest(orderIdValidation), getOrderById);

// Create order
router.post("/", authenticateToken, validateRequest(createOrderValidation), createOrder);

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

export default router;
