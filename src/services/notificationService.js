import Notification from "../models/Notification.js";
import Admin from "../models/Admin.js";
import User from "../models/User.js";
import { emitNotificationToUser } from "../sockets/socketGateway.js";
import { AppError } from "../utils/helpers.js";

const ORDER_STATUS_LABELS = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  packing: "Đang đóng gói",
  shipping: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
  returned: "Đã trả",
};

const PAYMENT_STATUS_LABELS = {
  pending: "Chờ thanh toán",
  paid: "Đã thanh toán",
  failed: "Thanh toán lỗi",
  refunded: "Đã hoàn tiền",
};

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
      this.emitRealtimeNotification(notification);
      return notification;
    } catch (error) {
      throw error;
    }
  }

  async createNotifications(items = []) {
    try {
      const payload = (items || [])
        .map((item) => ({
          ...item,
          userId: this.normalizeObjectId(item.userId),
          title: item.title?.toString().trim() || "",
          body: item.body?.toString().trim() || "",
          type: item.type || "system",
          channel: item.channel && item.channel.length > 0 ? item.channel : ["in_app"],
          createdAt: new Date(),
        }))
        .filter((item) => item.userId && item.title && item.body);

      if (payload.length === 0) {
        return [];
      }

      const inserted = await Notification.insertMany(payload, { ordered: false });
      inserted.forEach((notification) => {
        this.emitRealtimeNotification(notification);
      });
      return inserted;
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

  async countUnread(userId) {
    try {
      return await Notification.countDocuments({
        userId,
        isRead: false,
      });
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

  async getActiveAdminIds() {
    const admins = await Admin.find({
      isDeleted: false,
      isActive: true,
    })
      .select("_id")
      .lean();

    return admins.map((item) => item._id?.toString()).filter(Boolean);
  }

  async notifyOrderCreated(order) {
    try {
      const orderId = order?._id?.toString?.() || "";
      const orderNumber = order?.orderNumber || orderId;
      const ownerUserId = order?.userId?.toString?.() || null;

      const rows = [];

      if (ownerUserId) {
        rows.push({
          userId: ownerUserId,
          type: "order_update",
          title: "Đơn hàng đã được tạo",
          body: `Đơn ${orderNumber} đã được ghi nhận. Chúng tôi sẽ xác nhận sớm nhất.`,
          link: `/orders/${orderId}`,
          channel: ["in_app"],
        });
      }

      const adminIds = await this.getActiveAdminIds();
      adminIds.forEach((adminId) => {
        rows.push({
          userId: adminId,
          type: "system",
          title: "Đơn hàng mới",
          body: `Có đơn ${orderNumber} vừa được tạo, vui lòng kiểm tra và xử lý.`,
          link: "/admin/orders",
          channel: ["in_app"],
        });
      });

      await this.createNotifications(rows);
    } catch {
      // Do not block order flow due to notification error.
    }
  }

  async notifyOrderStatusChanged(order, previousStatus = "") {
    try {
      const orderId = order?._id?.toString?.() || "";
      const orderNumber = order?.orderNumber || orderId;
      const ownerUserId = order?.userId?.toString?.() || null;
      const nextStatus = order?.status || "";

      const rows = [];

      if (ownerUserId && nextStatus) {
        const previousStatusLabel =
          ORDER_STATUS_LABELS[previousStatus] || previousStatus || "trạng thái trước";
        const nextStatusLabel = ORDER_STATUS_LABELS[nextStatus] || nextStatus;
        rows.push({
          userId: ownerUserId,
          type: "order_update",
          title: "Đơn hàng cập nhật trạng thái",
          body: `Đơn ${orderNumber} đã chuyển từ ${previousStatusLabel} sang ${nextStatusLabel}.`,
          link: `/orders/${orderId}`,
          channel: ["in_app"],
        });
      }

      if (nextStatus === "cancelled") {
        const adminIds = await this.getActiveAdminIds();
        adminIds.forEach((adminId) => {
          rows.push({
            userId: adminId,
            type: "system",
            title: "Đơn hàng bị hủy",
            body: `Đơn ${orderNumber} đã bị hủy, vui lòng kiểm tra nguyên nhân.`,
            link: "/admin/orders",
            channel: ["in_app"],
          });
        });
      }

      await this.createNotifications(rows);
    } catch {
      // Do not block order flow due to notification error.
    }
  }

  async notifyPaymentStatusChanged(order, previousStatus = "", nextStatus = "") {
    try {
      const orderId = order?._id?.toString?.() || "";
      const orderNumber = order?.orderNumber || orderId;
      const ownerUserId = order?.userId?.toString?.() || null;

      const rows = [];

      if (ownerUserId && nextStatus) {
        const previousStatusLabel =
          PAYMENT_STATUS_LABELS[previousStatus] || previousStatus || "chưa xác định";
        const nextStatusLabel = PAYMENT_STATUS_LABELS[nextStatus] || nextStatus;
        rows.push({
          userId: ownerUserId,
          type: "order_update",
          title: "Thanh toán đơn hàng đã cập nhật",
          body: `Thanh toán đơn ${orderNumber} đã đổi từ ${previousStatusLabel} sang ${nextStatusLabel}.`,
          link: `/orders/${orderId}`,
          channel: ["in_app"],
        });
      }

      if (nextStatus === "failed") {
        const adminIds = await this.getActiveAdminIds();
        adminIds.forEach((adminId) => {
          rows.push({
            userId: adminId,
            type: "system",
            title: "Cảnh báo thanh toán lỗi",
            body: `Đơn ${orderNumber} có giao dịch thanh toán thất bại, cần kiểm tra lại.`,
            link: "/admin/orders",
            channel: ["in_app"],
          });
        });
      }

      await this.createNotifications(rows);
    } catch {
      // Do not block payment flow due to notification error.
    }
  }

  async notifyFlashSalePublished(flashSale) {
    try {
      const saleName = flashSale?.name?.toString?.().trim() || "Flash Sale mới";
      const startsAt = flashSale?.startsAt ? new Date(flashSale.startsAt) : null;
      const startsAtText =
        startsAt && !Number.isNaN(startsAt.getTime())
          ? new Intl.DateTimeFormat("vi-VN", {
              dateStyle: "short",
              timeStyle: "short",
            }).format(startsAt)
          : "sớm nhất";

      const users = await User.find({
        isDeleted: false,
        status: "active",
      })
        .select("_id")
        .lean();

      const rows = users.map((user) => ({
        userId: user._id?.toString(),
        type: "promo",
        title: "Flash Sale mới",
        body: `${saleName} sẽ bắt đầu lúc ${startsAtText}. Vào ngay để không bỏ lỡ deal.`,
        link: "/flash-sales",
        channel: ["in_app"],
      }));

      await this.createNotifications(rows);

      const adminIds = await this.getActiveAdminIds();
      await this.createNotifications(
        adminIds.map((adminId) => ({
          userId: adminId,
          type: "system",
          title: "Đã phát thông báo Flash Sale",
          body: `${saleName} đã được phát tới người dùng.`,
          link: `/admin/flash-sales`,
          channel: ["in_app"],
        })),
      );
    } catch {
      // Do not block flash sale flow due to notification error.
    }
  }

  async notifyReviewReply(review) {
    try {
      const ownerUserId = review?.userId?.toString?.() || null;
      const replyBody = review?.adminReply?.body?.toString?.().trim() || "";
      const productRef = review?.productId;
      const productName =
        productRef &&
        typeof productRef === "object" &&
        "name" in productRef &&
        productRef.name
          ? productRef.name.toString().trim()
          : "sản phẩm";
      const productSlug =
        productRef &&
        typeof productRef === "object" &&
        "slug" in productRef &&
        productRef.slug
          ? productRef.slug.toString().trim()
          : "";

      if (!ownerUserId || !replyBody) {
        return;
      }

      await this.createNotification({
        userId: ownerUserId,
        type: "review_reply",
        title: "Shop đã phản hồi đánh giá của bạn",
        body: `Đánh giá cho ${productName} đã có phản hồi mới từ cửa hàng.`,
        link: productSlug ? `/products/${productSlug}` : "/account",
        channel: ["in_app"],
      });
    } catch {
      // Do not block review flow due to notification error.
    }
  }

  normalizeObjectId(value) {
    const normalized = value?.toString?.().trim?.() || "";
    return normalized || null;
  }

  emitRealtimeNotification(notification) {
    try {
      const channels = Array.isArray(notification?.channel) ? notification.channel : [];
      if (!channels.includes("in_app")) {
        return;
      }

      const userId = notification?.userId?.toString?.() || "";
      if (!userId) {
        return;
      }

      emitNotificationToUser(userId, {
        notification: {
          id: notification?._id?.toString?.() || "",
          userId,
          type: notification?.type || "system",
          title: notification?.title || "",
          body: notification?.body || "",
          imageUrl: notification?.imageUrl || "",
          link: notification?.link || "",
          isRead: Boolean(notification?.isRead),
          readAt: notification?.readAt || null,
          channel: channels,
          createdAt: notification?.createdAt || new Date(),
        },
      });
    } catch {
      // Do not block create notification flow due to realtime emit error.
    }
  }
}

export default new NotificationService();
