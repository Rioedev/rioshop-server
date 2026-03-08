import {
  asyncHandler,
  sendSuccess,
  getPaginationParams,
} from "../utils/helpers.js";
import notificationService from "../services/notificationService.js";

export const getNotifications = asyncHandler(async (req, res) => {
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);
  const notifications = await notificationService.getUserNotifications(req.user.userId, {
    page,
    limit,
    unreadOnly: req.query.unreadOnly === "true",
  });

  sendSuccess(res, 200, notifications, "Notifications retrieved");
});

export const markAsRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markAsRead(
    req.user.userId,
    req.params.id,
  );
  sendSuccess(res, 200, notification, "Notification marked as read");
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await notificationService.deleteNotification(
    req.user.userId,
    req.params.id,
  );
  sendSuccess(res, 200, notification, "Notification deleted");
});
