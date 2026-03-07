import nodemailer from "nodemailer";

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendOrderConfirmation(orderData) {
    try {
      const html = `
        <h1>Xác Nhận Đơn Hàng</h1>
        <p>Cảm ơn bạn đã đặt hàng!</p>
        <p><strong>Mã Đơn Hàng:</strong> ${orderData.orderNumber}</p>
        <p><strong>Tổng Tiền:</strong> ${orderData.total.toLocaleString("vi-VN")} VND</p>
        <p><strong>Dự Kiến Giao:</strong> ${orderData.estimatedDelivery}</p>
        <a href="${process.env.FRONTEND_URL}/orders/${orderData.orderId}">Theo Dõi Đơn Hàng</a>
      `;

      await this.transporter.sendMail({
        from: process.env.SMTP_USER,
        to: orderData.email,
        subject: `Xác Nhận Đơn Hàng - ${orderData.orderNumber}`,
        html,
      });

      return true;
    } catch (error) {
      console.error("Email sending failed:", error);
      throw error;
    }
  }

  async sendOrderShipped(orderData) {
    try {
      const html = `
        <h1>Đơn Hàng Của Bạn Đã Được Gửi</h1>
        <p>Đơn hàng ${orderData.orderNumber} của bạn đang trên đường giao!</p>
        <p><strong>Mã Vận Đơn:</strong> ${orderData.trackingCode}</p>
        <p><strong>Đơn Vị Vận Chuyển:</strong> ${orderData.carrier}</p>
        <a href="${orderData.trackingUrl}">Theo Dõi Gói Hàng</a>
      `;

      await this.transporter.sendMail({
        from: process.env.SMTP_USER,
        to: orderData.email,
        subject: `Xác Nhận Giao Hàng - ${orderData.orderNumber}`,
        html,
      });

      return true;
    } catch (error) {
      console.error("Email sending failed:", error);
      throw error;
    }
  }

  async sendPasswordReset(email, resetToken) {
    try {
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      const html = `
        <h1>Yêu Cầu Đặt Lại Mật Khẩu</h1>
        <p>Nhấp vào liên kết dưới đây để đặt lại mật khẩu của bạn:</p>
        <a href="${resetUrl}">Đặt Lại Mật Khẩu</a>
        <p>Liên kết này sẽ hết hạn trong 1 giờ.</p>
      `;

      await this.transporter.sendMail({
        from: process.env.SMTP_USER,
        to: email,
        subject: "Yêu Cầu Đặt Lại Mật Khẩu",
        html,
      });

      return true;
    } catch (error) {
      console.error("Email sending failed:", error);
      throw error;
    }
  }

  async sendWelcomeEmail(userData) {
    try {
      const html = `
        <h1>Chào Mừng Đến Rioshop!</h1>
        <p>Xin chào ${userData.fullName},</p>
        <p>Cảm ơn bạn đã tạo tài khoản với chúng tôi.</p>
        <p>Mã Giới Thiệu Của Bạn: <strong>${userData.referralCode}</strong></p>
        <a href="${process.env.FRONTEND_URL}">Bắt Đầu Mua Sắm</a>
      `;

      await this.transporter.sendMail({
        from: process.env.SMTP_USER,
        to: userData.email,
        subject: "Chào Mừng Đến Rioshop!",
        html,
      });

      return true;
    } catch (error) {
      console.error("Email sending failed:", error);
      throw error;
    }
  }

  async sendReviewReminder(orderData) {
    try {
      const html = `
        <h1>Hãy Chia Sẻ Ý Kiến Của Bạn!</h1>
        <p>Đơn hàng ${orderData.orderNumber} của bạn đã được giao.</p>
        <p>Chúng tôi rất muốn nghe phản hồi của bạn về các sản phẩm.</p>
        <a href="${process.env.FRONTEND_URL}/orders/${orderData.orderId}/reviews">Để Lại Đánh Giá</a>
      `;

      await this.transporter.sendMail({
        from: process.env.SMTP_USER,
        to: orderData.email,
        subject: "Yêu Cầu Đánh Giá Đơn Hàng Của Bạn",
        html,
      });

      return true;
    } catch (error) {
      console.error("Email sending failed:", error);
      throw error;
    }
  }
}

export default new EmailService();
