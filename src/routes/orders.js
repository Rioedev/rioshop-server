import express from "express";
import {
  asyncHandler,
  sendSuccess,
  getPaginationParams,
} from "../utils/helpers.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = express.Router();

// Get all orders
router.get(
  "/",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { page, limit } = getPaginationParams(
      req.query.page,
      req.query.limit,
    );
    sendSuccess(
      res,
      200,
      { orders: [], pagination: { page, limit } },
      "Orders retrieved",
    );
  }),
);

// Get order by ID
router.get(
  "/:id",
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Order retrieved");
  }),
);

// Create order
router.post(
  "/",
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, 201, {}, "Order created successfully");
  }),
);

// Update order status
router.patch(
  "/:id/status",
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Order status updated");
  }),
);

// Cancel order
router.post(
  "/:id/cancel",
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Order cancelled");
  }),
);

export default router;
