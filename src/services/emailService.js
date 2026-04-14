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
const EMAIL_BRAND = {
  primary: "#1d4ed8",
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  surface: "#f8fafc",
};

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

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderInfoRows = (rows = []) =>
  rows
    .map(
      (row) => `
        <tr>
          <td style="padding: 8px 0; color: ${EMAIL_BRAND.muted}; width: 170px; vertical-align: top;">
            ${escapeHtml(row.label || "")}
          </td>
          <td style="padding: 8px 0; color: ${EMAIL_BRAND.text}; font-weight: 600;">
            ${escapeHtml(row.value || "-")}
          </td>
        </tr>
      `,
    )
    .join("");

const buildEmailLayout = ({
  title = "",
  subtitle = "",
  contentHtml = "",
  actionUrl = "",
  actionLabel = "",
  footerText = "Nếu bạn cần hỗ trợ, hãy phản hồi email này để đội ngũ RioShop hỗ trợ nhanh nhất.",
}) => `
  <div style="margin: 0; padding: 24px 12px; background: #f1f5f9; font-family: Arial, sans-serif; color: ${EMAIL_BRAND.text};">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 640px; margin: 0 auto; border-collapse: collapse;">
      <tr>
        <td style="padding: 0;">
          <div style="background: linear-gradient(135deg, #1d4ed8, #2563eb); border-radius: 14px 14px 0 0; padding: 22px 24px;">
            <div style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #bfdbfe; font-weight: 700;">RioShop</div>
            <h1 style="margin: 8px 0 0; font-size: 22px; line-height: 1.35; color: #ffffff;">
              ${escapeHtml(title)}
            </h1>
          </div>
          <div style="background: #ffffff; border: 1px solid ${EMAIL_BRAND.border}; border-top: none; border-radius: 0 0 14px 14px; padding: 24px;">
            ${
              subtitle
                ? `<p style="margin: 0 0 16px; color: ${EMAIL_BRAND.muted}; line-height: 1.6;">${escapeHtml(subtitle)}</p>`
                : ""
            }
            ${contentHtml}
            ${
              actionUrl && actionLabel
                ? `
                <p style="margin: 22px 0 0;">
                  <a
                    href="${escapeHtml(actionUrl)}"
                    style="display: inline-block; background: ${EMAIL_BRAND.primary}; color: #ffffff; text-decoration: none; padding: 11px 18px; border-radius: 10px; font-weight: 700;"
                  >
                    ${escapeHtml(actionLabel)}
                  </a>
                </p>
              `
                : ""
            }
          </div>
          <p style="margin: 12px 4px 0; color: ${EMAIL_BRAND.muted}; font-size: 12px; line-height: 1.5;">
            ${escapeHtml(footerText)}
          </p>
        </td>
      </tr>
    </table>
  </div>
`;

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
    const createdAtText = order?.createdAt
      ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(
          new Date(order.createdAt),
        )
      : "";

    const itemsHtml = (order?.items || [])
      .slice(0, 8)
      .map((item) => {
        const lineTotal = formatCurrency(item.totalPrice || 0, order?.pricing?.currency || "VND");
        return `
          <tr>
            <td style="padding: 8px 0; color: ${EMAIL_BRAND.text};">
              ${escapeHtml(item.productName || "Sản phẩm")} ${item.variantLabel ? `(${escapeHtml(item.variantLabel)})` : ""}
            </td>
            <td style="padding: 8px 0; text-align: right; color: ${EMAIL_BRAND.muted};">
              x${Number(item.quantity || 0)}
            </td>
            <td style="padding: 8px 0 8px 12px; text-align: right; color: ${EMAIL_BRAND.text}; font-weight: 700;">
              ${escapeHtml(lineTotal)}
            </td>
          </tr>
        `;
      })
      .join("");

    const contentHtml = `
      <div style="border: 1px solid ${EMAIL_BRAND.border}; border-radius: 12px; background: ${EMAIL_BRAND.surface}; padding: 14px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
          ${renderInfoRows([
            { label: "Mã đơn", value: orderNumber },
            { label: "Trạng thái", value: statusLabel },
            { label: "Tổng thanh toán", value: total },
            { label: "Phương thức thanh toán", value: paymentMethod },
            { label: "Thời gian đặt", value: createdAtText || "-" },
          ])}
        </table>
      </div>
      <div style="margin-top: 16px; border: 1px solid ${EMAIL_BRAND.border}; border-radius: 12px; padding: 12px 16px;">
        <p style="margin: 0 0 8px; font-weight: 700; color: ${EMAIL_BRAND.text};">Sản phẩm trong đơn</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
          ${itemsHtml || `<tr><td style="padding: 6px 0; color: ${EMAIL_BRAND.muted};">Chưa có dữ liệu sản phẩm.</td></tr>`}
        </table>
      </div>
    `;
    const html = buildEmailLayout({
      title: `Xác nhận đơn hàng ${orderNumber}`,
      subtitle: "RioShop đã nhận đơn của bạn. Cảm ơn bạn đã mua sắm cùng chúng tôi.",
      contentHtml,
      actionUrl: detailUrl,
      actionLabel: "Xem chi tiết đơn hàng",
    });

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

    const html = buildEmailLayout({
      title: `Cập nhật đơn hàng ${orderNumber}`,
      subtitle: "Trạng thái đơn hàng của bạn vừa được cập nhật.",
      contentHtml: `
        <div style="border: 1px solid ${EMAIL_BRAND.border}; border-radius: 12px; background: ${EMAIL_BRAND.surface}; padding: 14px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
            ${renderInfoRows([
              { label: "Mã đơn", value: orderNumber },
              { label: "Từ trạng thái", value: previousStatusLabel || "N/A" },
              { label: "Sang trạng thái", value: nextStatusLabel },
            ])}
          </table>
        </div>
      `,
      actionUrl: detailUrl,
      actionLabel: "Xem chi tiết đơn hàng",
    });

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

    const html = buildEmailLayout({
      title: `Cập nhật thanh toán đơn ${orderNumber}`,
      subtitle: "Thông tin thanh toán của đơn hàng đã thay đổi.",
      contentHtml: `
        <div style="border: 1px solid ${EMAIL_BRAND.border}; border-radius: 12px; background: ${EMAIL_BRAND.surface}; padding: 14px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
            ${renderInfoRows([
              { label: "Mã đơn", value: orderNumber },
              { label: "Từ trạng thái", value: previousLabel },
              { label: "Sang trạng thái", value: nextLabel },
            ])}
          </table>
        </div>
      `,
      actionUrl: detailUrl,
      actionLabel: "Xem chi tiết đơn hàng",
    });

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

    const html = buildEmailLayout({
      title: "Yêu cầu đặt lại mật khẩu",
      subtitle: "Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản RioShop.",
      contentHtml: `
        <div style="border: 1px solid ${EMAIL_BRAND.border}; border-radius: 12px; background: ${EMAIL_BRAND.surface}; padding: 14px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
            ${renderInfoRows([
              { label: "Mã user", value: userId },
              { label: "Reset token", value: resetToken },
              { label: "Hiệu lực", value: "1 giờ kể từ khi nhận email" },
            ])}
          </table>
        </div>
      `,
      actionUrl: resetUrl,
      actionLabel: "Mở trang đặt lại mật khẩu",
      footerText:
        "Nếu bạn không yêu cầu đổi mật khẩu, hãy bỏ qua email này để bảo toàn tài khoản.",
    });

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

    const html = buildEmailLayout({
      title: "Chào mừng bạn đến với RioShop",
      subtitle: `Xin chào ${fullName}, tài khoản của bạn đã được tạo thành công.`,
      contentHtml: `
        <div style="border: 1px solid ${EMAIL_BRAND.border}; border-radius: 12px; background: ${EMAIL_BRAND.surface}; padding: 14px 16px;">
          <p style="margin: 0; color: ${EMAIL_BRAND.text};">
            Bạn có thể bắt đầu mua sắm ngay, theo dõi đơn hàng và tích điểm thành viên trên RioShop.
          </p>
        </div>
      `,
      actionUrl: storefrontUrl,
      actionLabel: "Bắt đầu mua sắm",
    });

    return this.sendMail({
      to: email,
      subject: "[RioShop] Chao mung ban",
      html,
      text: `Xin chao ${fullName}, tai khoan RioShop cua ban da duoc tao thanh cong.`,
    });
  }
}

export default new EmailService();

