import Notification from "../models/Notification.js";
import { AppError } from "../utils/helpers.js";

export class NotificationService {
  async getUserNotifications(userId, options = {}) {
    const { page = 1, limit = 20, unreadOnly = false } = options;
    const query = { userId };

    if (unreadOnly) {
      query.isRead = false;
    }

    try {
      const skip = (page - 1) * limit;
      const [notifications, totalDocs] = await Promise.all([
        Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Notification.countDocuments(query),
      ]);

      return {
        docs: notifications,
        totalDocs,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalDocs / limit)),
        hasPrevPage: page > 1,
        hasNextPage: skip + notifications.length < totalDocs,
      };
    } catch (error) {
      throw error;
    }
  }

  async createNotification(data) {
    try {
      const notification = new Notification({
        ...data,
        createdAt: new Date(),
      });
      await notification.save();
      return notification;
    } catch (error) {
      throw error;
    }
  }

  async markAsRead(userId, notificationId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        {
          isRead: true,
          readAt: new Date(),
        },
        { new: true },
      );

      if (!notification) {
        throw new AppError("Notification not found", 404);
      }

      return notification;
    } catch (error) {
      throw error;
    }
  }

  async markAllAsRead(userId) {
    try {
      const result = await Notification.updateMany(
        { userId, isRead: false },
        { isRead: true, readAt: new Date() },
      );

      return {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      };
    } catch (error) {
      throw error;
    }
  }

  async deleteNotification(userId, notificationId) {
    try {
      const notification = await Notification.findOneAndDelete({
        _id: notificationId,
        userId,
      });

      if (!notification) {
        throw new AppError("Notification not found", 404);
      }

      return notification;
    } catch (error) {
      throw error;
    }
  }
}

export default new NotificationService();
