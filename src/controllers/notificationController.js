import {
  asyncHandler,
  sendError,
  sendSuccess,
  getPaginationParams,
} from "../utils/helpers.js";
import notificationService from "../services/notificationService.js";

export const getNotifications = asyncHandler(async (req, res) => {
  const principalId = req.user.userId || req.user.adminId;
  if (!principalId) {
    return sendError(res, 401, "Unauthorized");
  }

  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);
  const notifications = await notificationService.getUserNotifications(principalId, {
    page,
    limit,
    unreadOnly: req.query.unreadOnly === "true",
  });

  sendSuccess(res, 200, notifications, "Notifications retrieved");
});

export const getUnreadCount = asyncHandler(async (req, res) => {
  const principalId = req.user.userId || req.user.adminId;
  if (!principalId) {
    return sendError(res, 401, "Unauthorized");
  }

  const count = await notificationService.countUnread(principalId);
  sendSuccess(res, 200, { unreadCount: count }, "Unread notification count retrieved");
});

export const markAsRead = asyncHandler(async (req, res) => {
  const principalId = req.user.userId || req.user.adminId;
  if (!principalId) {
    return sendError(res, 401, "Unauthorized");
  }

  const notification = await notificationService.markAsRead(
    principalId,
    req.params.id,
  );
  sendSuccess(res, 200, notification, "Notification marked as read");
});

export const markAllAsRead = asyncHandler(async (req, res) => {
  const principalId = req.user.userId || req.user.adminId;
  if (!principalId) {
    return sendError(res, 401, "Unauthorized");
  }

  const result = await notificationService.markAllAsRead(principalId);
  sendSuccess(res, 200, result, "All notifications marked as read");
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const principalId = req.user.userId || req.user.adminId;
  if (!principalId) {
    return sendError(res, 401, "Unauthorized");
  }

  const notification = await notificationService.deleteNotification(
    principalId,
    req.params.id,
  );
  sendSuccess(res, 200, notification, "Notification deleted");
});
