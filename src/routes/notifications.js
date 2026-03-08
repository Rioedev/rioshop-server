import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validation.js";
import {
  getNotifications,
  markAsRead,
  deleteNotification,
} from "../controllers/notificationController.js";
import {
  getNotificationsValidation,
  notificationIdValidation,
} from "../validations/notifications.js";

const router = express.Router();

// Get notifications
router.get(
  "/",
  authenticateToken,
  validateRequest(getNotificationsValidation),
  getNotifications,
);

// Mark as read
router.put(
  "/:id/read",
  authenticateToken,
  validateRequest(notificationIdValidation),
  markAsRead,
);

// Delete notification
router.delete(
  "/:id",
  authenticateToken,
  validateRequest(notificationIdValidation),
  deleteNotification,
);

export default router;
