import express from "express";
import {
  asyncHandler,
  sendSuccess,
  getPaginationParams,
} from "../utils/helpers.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = express.Router();

// Get notifications
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
      { notifications: [], pagination: { page, limit } },
      "Notifications retrieved",
    );
  }),
);

// Mark as read
router.put(
  "/:id/read",
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Notification marked as read");
  }),
);

// Delete notification
router.delete(
  "/:id",
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Notification deleted");
  }),
);

export default router;
