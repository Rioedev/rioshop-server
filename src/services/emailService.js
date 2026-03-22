import nodemailer from "nodemailer";

const ORDER_STATUS_LABELS = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  packing: "Đang chuẩn bị",
  shipping: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
  returned: "Đã hoàn",
};

const PAYMENT_STATUS_LABELS = {
  pending: "Chưa thanh toán",
  paid: "Đã thanh toán",
  failed: "Thanh toán lỗi",
  refunded: "Đã hoàn tiền",
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
    const fromEmail = firstNonEmptyString(process.env.SMTP_FROM_EMAIL, process.env.SMTP_USER);
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

  async sendMail(payload = {}) {
    const { to, subject, html, text = "", throwOnError = false } = payload;

    if (!this.isEnabled()) {
      return { success: false, skipped: true, reason: "email_disabled" };
    }

    if (!to) {
      return { success: false, skipped: true, reason: "missing_recipient" };
    }

    const from = this.getFromAddress();
    if (!from) {
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

      return {
        success: true,
        messageId: info.messageId,
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
      return { success: false, skipped: true, reason: "missing_order_email" };
    }

    const detailUrl = this.getOrderDetailUrl(order?._id?.toString());
    const orderNumber = order?.orderNumber || order?._id?.toString() || "";
    const total = formatCurrency(order?.pricing?.total || 0, order?.pricing?.currency || "VND");
    const paymentMethod = (order?.paymentMethod || "cod").toString().toUpperCase();
    const statusLabel = ORDER_STATUS_LABELS[order?.status] || (order?.status || "pending");

    const itemsHtml = (order?.items || [])
      .slice(0, 8)
      .map((item) => {
        const lineTotal = formatCurrency(item.totalPrice || 0, order?.pricing?.currency || "VND");
        return `<li>${item.productName} (${item.variantLabel}) x ${item.quantity} - ${lineTotal}</li>`;
      })
      .join("");

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin: 0 0 12px;">Xác nhận đơn hàng ${orderNumber}</h2>
        <p>RioShop đã nhận đơn của bạn.</p>
        <p><strong>Trạng thái:</strong> ${statusLabel}</p>
        <p><strong>Tổng thanh toán:</strong> ${total}</p>
        <p><strong>Phương thức thanh toán:</strong> ${paymentMethod}</p>
        <p><strong>Sản phẩm:</strong></p>
        <ul>${itemsHtml}</ul>
        ${detailUrl ? `<p><a href="${detailUrl}">Xem chi tiết đơn hàng</a></p>` : ""}
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
      return { success: false, skipped: true, reason: "missing_order_email" };
    }

    const orderNumber = order?.orderNumber || order?._id?.toString() || "";
    const nextStatus = order?.status || "pending";
    const nextStatusLabel = ORDER_STATUS_LABELS[nextStatus] || nextStatus;
    const previousStatusLabel = ORDER_STATUS_LABELS[previousStatus] || previousStatus;
    const detailUrl = this.getOrderDetailUrl(order?._id?.toString());

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin: 0 0 12px;">Cập nhật đơn hàng ${orderNumber}</h2>
        <p>Trạng thái đơn hàng của bạn đã được cập nhật.</p>
        <p><strong>Từ:</strong> ${previousStatusLabel || "N/A"}</p>
        <p><strong>Sang:</strong> ${nextStatusLabel}</p>
        ${detailUrl ? `<p><a href="${detailUrl}">Xem chi tiết đơn hàng</a></p>` : ""}
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
      return { success: false, skipped: true, reason: "missing_order_email" };
    }

    const orderNumber = order?.orderNumber || order?._id?.toString() || "";
    const nextLabel = PAYMENT_STATUS_LABELS[nextPaymentStatus] || nextPaymentStatus || "N/A";
    const previousLabel =
      PAYMENT_STATUS_LABELS[previousPaymentStatus] || previousPaymentStatus || "N/A";
    const detailUrl = this.getOrderDetailUrl(order?._id?.toString());

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin: 0 0 12px;">Cập nhật thanh toán đơn ${orderNumber}</h2>
        <p><strong>Từ:</strong> ${previousLabel}</p>
        <p><strong>Sang:</strong> ${nextLabel}</p>
        ${detailUrl ? `<p><a href="${detailUrl}">Xem chi tiết đơn hàng</a></p>` : ""}
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
      return { success: false, skipped: true, reason: "invalid_payload" };
    }

    const storefrontUrl = this.getStorefrontUrl().replace(/\/+$/, "");
    const resetUrl = storefrontUrl
      ? `${storefrontUrl}/login?resetUserId=${encodeURIComponent(userId)}&resetToken=${encodeURIComponent(resetToken)}`
      : "";

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin: 0 0 12px;">Yêu cầu đặt lại mật khẩu</h2>
        <p>Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản RioShop.</p>
        ${resetUrl ? `<p><a href="${resetUrl}">Mở trang đặt lại mật khẩu</a></p>` : ""}
        <p><strong>Mã user:</strong> ${userId}</p>
        <p><strong>Reset token:</strong> ${resetToken}</p>
        <p>Token có hiệu lực trong 1 giờ.</p>
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
