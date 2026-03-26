import nodemailer from "nodemailer";

const ORDER_STATUS_LABELS = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  packing: "Đang đóng gói",
  ready_to_ship: "Chờ lấy hàng",
  shipping: "Đang giao",
  delivered: "Đã giao",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  returned: "Đã hoàn",
};

const PAYMENT_STATUS_LABELS = {
  pending: "Chưa thanh toán",
  paid: "Đã thanh toán",
  failed: "Thanh toán lỗi",
  refunded: "Đã hoàn tiền",
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

  return ORDER_STATUS_LABELS[nextStatus] || nextStatus || "pending";
};
const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
};

const firstNonEmptyString = (...values) =>
  values.find((value) => typeof value === "string" && value.trim()) || "";

const formatCurrency = (value = 0, currency = "VND") =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

class EmailService {
  constructor() {
    this.transporter = null;
  }

  isEnabled() {
    const envSwitch = process.env.EMAIL_ENABLED;
    if (envSwitch !== undefined) {
      return parseBoolean(envSwitch, true);
    }

    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  getPort() {
    const port = Number(process.env.SMTP_PORT || 587);
    return Number.isFinite(port) && port > 0 ? port : 587;
  }

  getSecureFlag() {
    const defaultSecure = this.getPort() === 465;
    return parseBoolean(process.env.SMTP_SECURE, defaultSecure);
  }

  getFromAddress() {
    const fromEmail = firstNonEmptyString(process.env.SMTP_FROM_EMAIL);
    const fromName = firstNonEmptyString(process.env.SMTP_FROM_NAME, "RioShop");

    if (!fromEmail) {
      return "";
    }

    return `${fromName} <${fromEmail}>`;
  }

  getStorefrontUrl() {
    const fallbackFromCors = firstNonEmptyString(
      ...(process.env.CORS_ORIGIN || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    );

    return firstNonEmptyString(
      process.env.STOREFRONT_URL,
      process.env.FRONTEND_URL,
      fallbackFromCors,
    );
  }

  getOrderDetailUrl(orderId) {
    const storefrontUrl = this.getStorefrontUrl();
    if (!storefrontUrl || !orderId) {
      return "";
    }

    return `${storefrontUrl.replace(/\/+$/, "")}/orders/${orderId}`;
  }

  getTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: this.getPort(),
      secure: this.getSecureFlag(),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    return this.transporter;
  }

  shouldLog() {
    if (process.env.EMAIL_LOG_VERBOSE !== undefined) {
      return parseBoolean(process.env.EMAIL_LOG_VERBOSE, true);
    }

    return process.env.NODE_ENV !== "production";
  }

  async sendMail(payload = {}) {
    const { to, subject, html, text = "", throwOnError = false } = payload;

    if (!this.isEnabled()) {
      if (this.shouldLog()) {
        console.warn("[email] skipped: email_disabled");
      }
      return { success: false, skipped: true, reason: "email_disabled" };
    }

    if (!to) {
      if (this.shouldLog()) {
        console.warn("[email] skipped: missing_recipient", { subject });
      }
      return { success: false, skipped: true, reason: "missing_recipient" };
    }

    const from = this.getFromAddress();
    if (!from) {
      if (this.shouldLog()) {
        console.warn("[email] skipped: missing_sender", { to, subject });
      }
      return { success: false, skipped: true, reason: "missing_sender" };
    }

    try {
      const info = await this.getTransporter().sendMail({
        from,
        to,
        subject,
        html,
        text,
      });

      if (this.shouldLog()) {
        console.info("[email] sent", {
          to,
          subject,
          messageId: info.messageId,
          accepted: info.accepted || [],
          rejected: info.rejected || [],
          response: info.response || "",
        });
      }

      return {
        success: true,
        messageId: info.messageId,
        accepted: info.accepted || [],
        rejected: info.rejected || [],
        response: info.response || "",
      };
    } catch (error) {
      console.error("Email sending failed:", error?.message || error);
      if (throwOnError) {
        throw error;
      }
      return {
        success: false,
        skipped: false,
        reason: "send_failed",
        error: error?.message || "unknown_error",
      };
    }
  }

  async sendOrderConfirmation(order) {
    const email = order?.customerSnapshot?.email?.trim();
    if (!email) {
      if (this.shouldLog()) {
        console.warn("[email] skipped: missing_order_email", {
          orderId: order?._id?.toString?.() || "",
          orderNumber: order?.orderNumber || "",
        });
      }
      return { success: false, skipped: true, reason: "missing_order_email" };
    }

    const detailUrl = this.getOrderDetailUrl(order?._id?.toString());
    const orderNumber = order?.orderNumber || order?._id?.toString() || "";
    const total = formatCurrency(order?.pricing?.total || 0, order?.pricing?.currency || "VND");
    const paymentMethod = (order?.paymentMethod || "cod").toString().toUpperCase();
    const statusLabel = resolveOrderStatusLabel(order, order?.status || "pending");

    const itemsHtml = (order?.items || [])
      .slice(0, 8)
      .map((item) => {
        const lineTotal = formatCurrency(item.totalPrice || 0, order?.pricing?.currency || "VND");
        return `<li>${item.productName} (${item.variantLabel}) x ${item.quantity} - ${lineTotal}</li>`;
      })
      .join("");

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin: 0 0 12px;">XÃ¡c nháº­n Ä‘Æ¡n hÃ ng ${orderNumber}</h2>
        <p>RioShop Ä‘Ã£ nháº­n Ä‘Æ¡n cá»§a báº¡n.</p>
        <p><strong>Tráº¡ng thÃ¡i:</strong> ${statusLabel}</p>
        <p><strong>Tá»•ng thanh toÃ¡n:</strong> ${total}</p>
        <p><strong>PhÆ°Æ¡ng thá»©c thanh toÃ¡n:</strong> ${paymentMethod}</p>
        <p><strong>Sáº£n pháº©m:</strong></p>
        <ul>${itemsHtml}</ul>
        ${detailUrl ? `<p><a href="${detailUrl}">Xem chi tiáº¿t Ä‘Æ¡n hÃ ng</a></p>` : ""}
      </div>
    `;

    const text = `Don hang ${orderNumber} da duoc tao. Tong thanh toan: ${total}.`;

    return this.sendMail({
      to: email,
      subject: `[RioShop] Xac nhan don hang ${orderNumber}`,
      html,
      text,
    });
  }

  async sendOrderStatusUpdate(order, previousStatus = "") {
    const email = order?.customerSnapshot?.email?.trim();
    if (!email) {
      if (this.shouldLog()) {
        console.warn("[email] skipped: missing_order_email", {
          orderId: order?._id?.toString?.() || "",
          orderNumber: order?.orderNumber || "",
        });
      }
      return { success: false, skipped: true, reason: "missing_order_email" };
    }

    const orderNumber = order?.orderNumber || order?._id?.toString() || "";
    const nextStatus = order?.status || "pending";
    const nextStatusLabel = resolveOrderStatusLabel(order, nextStatus);
    const previousStatusLabel = ORDER_STATUS_LABELS[previousStatus] || previousStatus;
    const detailUrl = this.getOrderDetailUrl(order?._id?.toString());

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin: 0 0 12px;">Cáº­p nháº­t Ä‘Æ¡n hÃ ng ${orderNumber}</h2>
        <p>Tráº¡ng thÃ¡i Ä‘Æ¡n hÃ ng cá»§a báº¡n Ä‘Ã£ Ä‘Æ°á»£c cáº­p nháº­t.</p>
        <p><strong>Tá»«:</strong> ${previousStatusLabel || "N/A"}</p>
        <p><strong>Sang:</strong> ${nextStatusLabel}</p>
        ${detailUrl ? `<p><a href="${detailUrl}">Xem chi tiáº¿t Ä‘Æ¡n hÃ ng</a></p>` : ""}
      </div>
    `;

    return this.sendMail({
      to: email,
      subject: `[RioShop] Don hang ${orderNumber} - ${nextStatusLabel}`,
      html,
      text: `Don hang ${orderNumber} da chuyen sang trang thai ${nextStatusLabel}.`,
    });
  }

  async sendPaymentStatusUpdate(order, previousPaymentStatus = "", nextPaymentStatus = "") {
    const email = order?.customerSnapshot?.email?.trim();
    if (!email) {
      if (this.shouldLog()) {
        console.warn("[email] skipped: missing_order_email", {
          orderId: order?._id?.toString?.() || "",
          orderNumber: order?.orderNumber || "",
          previousPaymentStatus,
          nextPaymentStatus,
        });
      }
      return { success: false, skipped: true, reason: "missing_order_email" };
    }

    const orderNumber = order?.orderNumber || order?._id?.toString() || "";
    const nextLabel = PAYMENT_STATUS_LABELS[nextPaymentStatus] || nextPaymentStatus || "N/A";
    const previousLabel =
      PAYMENT_STATUS_LABELS[previousPaymentStatus] || previousPaymentStatus || "N/A";
    const detailUrl = this.getOrderDetailUrl(order?._id?.toString());

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin: 0 0 12px;">Cáº­p nháº­t thanh toÃ¡n Ä‘Æ¡n ${orderNumber}</h2>
        <p><strong>Tá»«:</strong> ${previousLabel}</p>
        <p><strong>Sang:</strong> ${nextLabel}</p>
        ${detailUrl ? `<p><a href="${detailUrl}">Xem chi tiáº¿t Ä‘Æ¡n hÃ ng</a></p>` : ""}
      </div>
    `;

    return this.sendMail({
      to: email,
      subject: `[RioShop] Thanh toan don ${orderNumber} - ${nextLabel}`,
      html,
      text: `Trang thai thanh toan don ${orderNumber}: ${previousLabel} -> ${nextLabel}.`,
    });
  }

  async sendPasswordReset({ email, userId, resetToken }) {
    if (!email || !userId || !resetToken) {
      if (this.shouldLog()) {
        console.warn("[email] skipped: invalid_payload_password_reset", {
          email: Boolean(email),
          userId: Boolean(userId),
          resetToken: Boolean(resetToken),
        });
      }
      return { success: false, skipped: true, reason: "invalid_payload" };
    }

    const storefrontUrl = this.getStorefrontUrl().replace(/\/+$/, "");
    const resetUrl = storefrontUrl
      ? `${storefrontUrl}/forgot-password?userId=${encodeURIComponent(userId)}&token=${encodeURIComponent(resetToken)}`
      : "";

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin: 0 0 12px;">YÃªu cáº§u Ä‘áº·t láº¡i máº­t kháº©u</h2>
        <p>Báº¡n vá»«a yÃªu cáº§u Ä‘áº·t láº¡i máº­t kháº©u cho tÃ i khoáº£n RioShop.</p>
        ${resetUrl ? `<p><a href="${resetUrl}">Má»Ÿ trang Ä‘áº·t láº¡i máº­t kháº©u</a></p>` : ""}
        <p><strong>MÃ£ user:</strong> ${userId}</p>
        <p><strong>Reset token:</strong> ${resetToken}</p>
        <p>Token cÃ³ hiá»‡u lá»±c trong 1 giá».</p>
      </div>
    `;

    return this.sendMail({
      to: email,
      subject: "[RioShop] Dat lai mat khau",
      html,
      text: `Yeu cau dat lai mat khau. UserId: ${userId}. Token: ${resetToken}`,
    });
  }

  async sendWelcomeEmail(userData) {
    const email = userData?.email?.trim();
    if (!email) {
      if (this.shouldLog()) {
        console.warn("[email] skipped: missing_user_email", {
          userId: userData?._id?.toString?.() || "",
        });
      }
      return { success: false, skipped: true, reason: "missing_user_email" };
    }

    const storefrontUrl = this.getStorefrontUrl().replace(/\/+$/, "");
    const fullName = userData?.fullName || "ban";

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin: 0 0 12px;">Chao mung den voi RioShop</h2>
        <p>Xin chao ${fullName}, tai khoan cua ban da duoc tao thanh cong.</p>
        ${storefrontUrl ? `<p><a href="${storefrontUrl}">Bat dau mua sam</a></p>` : ""}
      </div>
    `;

    return this.sendMail({
      to: email,
      subject: "[RioShop] Chao mung ban",
      html,
      text: `Xin chao ${fullName}, tai khoan RioShop cua ban da duoc tao thanh cong.`,
    });
  }
}

export default new EmailService();

