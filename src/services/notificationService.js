import Notification from "../models/Notification.js";
import Admin from "../models/Admin.js";
import User from "../models/User.js";
import { emitNotificationToUser } from "../sockets/socketGateway.js";
import { AppError } from "../utils/helpers.js";

const ORDER_STATUS_LABELS = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  packing: "Đang đóng gói",
  ready_to_ship: "Chờ lấy hàng",
  shipping: "Đang giao",
  delivered: "Đã giao",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  returned: "Đã trả",
};

const ONLINE_PAYMENT_METHODS = new Set(["momo", "vnpay", "zalopay", "card", "bank_transfer"]);

const resolveOrderStatusLabel = (order = null, status = "") => {
  const nextStatus = (status || "").toString().trim();
  if (
    nextStatus === "pending" &&
    (order?.paymentStatus || "").toString().trim() === "pending" &&
    ONLINE_PAYMENT_METHODS.has((order?.paymentMethod || "").toString().trim())
  ) {
    return "Chờ thanh toán";
  }

  return ORDER_STATUS_LABELS[nextStatus] || nextStatus;
};

const PAYMENT_STATUS_LABELS = {
  pending: "Chá» thanh toÃ¡n",
  paid: "ÄÃ£ thanh toÃ¡n",
  failed: "Thanh toÃ¡n lá»—i",
  refunded: "ÄÃ£ hoÃ n tiá»n",
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
          title: "ÄÆ¡n hÃ ng Ä‘Ã£ Ä‘Æ°á»£c táº¡o",
          body: `ÄÆ¡n ${orderNumber} Ä‘Ã£ Ä‘Æ°á»£c ghi nháº­n. ChÃºng tÃ´i sáº½ xÃ¡c nháº­n sá»›m nháº¥t.`,
          link: `/orders/${orderId}`,
          channel: ["in_app"],
        });
      }

      const adminIds = await this.getActiveAdminIds();
      adminIds.forEach((adminId) => {
        rows.push({
          userId: adminId,
          type: "system",
          title: "ÄÆ¡n hÃ ng má»›i",
          body: `CÃ³ Ä‘Æ¡n ${orderNumber} vá»«a Ä‘Æ°á»£c táº¡o, vui lÃ²ng kiá»ƒm tra vÃ  xá»­ lÃ½.`,
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
          ORDER_STATUS_LABELS[previousStatus] || previousStatus || "tráº¡ng thÃ¡i trÆ°á»›c";
        const nextStatusLabel = resolveOrderStatusLabel(order, nextStatus);
        rows.push({
          userId: ownerUserId,
          type: "order_update",
          title: "ÄÆ¡n hÃ ng cáº­p nháº­t tráº¡ng thÃ¡i",
          body: `ÄÆ¡n ${orderNumber} Ä‘Ã£ chuyá»ƒn tá»« ${previousStatusLabel} sang ${nextStatusLabel}.`,
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
            title: "ÄÆ¡n hÃ ng bá»‹ há»§y",
            body: `ÄÆ¡n ${orderNumber} Ä‘Ã£ bá»‹ há»§y, vui lÃ²ng kiá»ƒm tra nguyÃªn nhÃ¢n.`,
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
          PAYMENT_STATUS_LABELS[previousStatus] || previousStatus || "chÆ°a xÃ¡c Ä‘á»‹nh";
        const nextStatusLabel = PAYMENT_STATUS_LABELS[nextStatus] || nextStatus;
        rows.push({
          userId: ownerUserId,
          type: "order_update",
          title: "Thanh toÃ¡n Ä‘Æ¡n hÃ ng Ä‘Ã£ cáº­p nháº­t",
          body: `Thanh toÃ¡n Ä‘Æ¡n ${orderNumber} Ä‘Ã£ Ä‘á»•i tá»« ${previousStatusLabel} sang ${nextStatusLabel}.`,
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
            title: "Cáº£nh bÃ¡o thanh toÃ¡n lá»—i",
            body: `ÄÆ¡n ${orderNumber} cÃ³ giao dá»‹ch thanh toÃ¡n tháº¥t báº¡i, cáº§n kiá»ƒm tra láº¡i.`,
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
      const saleName = flashSale?.name?.toString?.().trim() || "Flash Sale má»›i";
      const startsAt = flashSale?.startsAt ? new Date(flashSale.startsAt) : null;
      const startsAtText =
        startsAt && !Number.isNaN(startsAt.getTime())
          ? new Intl.DateTimeFormat("vi-VN", {
              dateStyle: "short",
              timeStyle: "short",
            }).format(startsAt)
          : "sá»›m nháº¥t";

      const users = await User.find({
        isDeleted: false,
        status: "active",
      })
        .select("_id")
        .lean();

      const rows = users.map((user) => ({
        userId: user._id?.toString(),
        type: "promo",
        title: "Flash Sale má»›i",
        body: `${saleName} sáº½ báº¯t Ä‘áº§u lÃºc ${startsAtText}. VÃ o ngay Ä‘á»ƒ khÃ´ng bá» lá»¡ deal.`,
        link: "/flash-sales",
        channel: ["in_app"],
      }));

      await this.createNotifications(rows);

      const adminIds = await this.getActiveAdminIds();
      await this.createNotifications(
        adminIds.map((adminId) => ({
          userId: adminId,
          type: "system",
          title: "ÄÃ£ phÃ¡t thÃ´ng bÃ¡o Flash Sale",
          body: `${saleName} Ä‘Ã£ Ä‘Æ°á»£c phÃ¡t tá»›i ngÆ°á»i dÃ¹ng.`,
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
          : "sáº£n pháº©m";
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
        title: "Shop Ä‘Ã£ pháº£n há»“i Ä‘Ã¡nh giÃ¡ cá»§a báº¡n",
        body: `ÄÃ¡nh giÃ¡ cho ${productName} Ä‘Ã£ cÃ³ pháº£n há»“i má»›i tá»« cá»­a hÃ ng.`,
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

