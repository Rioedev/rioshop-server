import axios from "axios";

// Momo Payment API
export class MomoPaymentService {
  static async createPayment(orderId, amount) {
    try {
      const response = await axios.post(
        "https://test-payment.momo.vn/v3/gateway/api/create",
        {
          partnerCode: process.env.MOMO_PARTNER_CODE,
          accessKey: process.env.MOMO_ACCESS_KEY,
          secretkey: process.env.MOMO_SECRET_KEY,
          orderId,
          amount,
          orderInfo: `Payment for order ${orderId}`,
          returnUrl: `${process.env.SOCKET_SERVER_URL}/api/v1/payments/momo/callback`,
          notifyUrl: `${process.env.SOCKET_SERVER_URL}/api/v1/payments/momo/webhook`,
          requestType: "captureWallet",
          extraData: "",
        },
      );

      return response.data;
    } catch (error) {
      throw new Error(`Momo payment creation failed: ${error.message}`);
    }
  }

  static async verifyPayment(transId) {
    try {
      const response = await axios.post(
        "https://test-payment.momo.vn/v3/gateway/api/query",
        {
          partnerCode: process.env.MOMO_PARTNER_CODE,
          accessKey: process.env.MOMO_ACCESS_KEY,
          secretKey: process.env.MOMO_SECRET_KEY,
          transId,
          orderId: transId,
        },
      );

      return response.data;
    } catch (error) {
      throw new Error(`Momo payment verification failed: ${error.message}`);
    }
  }
}

// VNPay Payment API
export class VNPaymentService {
  static async createPayment(orderId, amount, returnUrl) {
    try {
      const tmnCode = process.env.VNPAY_TMN_CODE;
      const secretKey = process.env.VNPAY_HASH_SECRET;
      const vnpUrl = "https://sandbox.vnpayment.vn/paygate";

      const date = new Date();
      const createDate = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}${String(date.getSeconds()).padStart(2, "0")}`;

      // Create payment URL - implementation depends on VNPay SDK
      return {
        paymentUrl: vnpUrl,
        orderId,
      };
    } catch (error) {
      throw new Error(`VNPay payment creation failed: ${error.message}`);
    }
  }
}

// ZaloPay Payment API
export class ZaloPaymentService {
  static async createPayment(orderId, amount) {
    try {
      const response = await axios.post(
        "https://sandbox.zalopay.com.vn/v001/tpc.queryentrustweb",
        {
          app_id: process.env.ZALOPAY_APP_ID,
          amount,
          app_trans_id: `${Date.now()}_${orderId}`,
          app_user: orderId,
          embed_data: JSON.stringify({
            preferred_payment_method: "qr_code",
            order_id: orderId,
          }),
          item: JSON.stringify([
            {
              itemid: orderId,
              itemname: "Order Payment",
              itemprice: amount,
              itemquantity: 1,
            },
          ]),
          description: `Payment for order ${orderId}`,
          callback_url: `${process.env.SOCKET_SERVER_URL}/api/v1/payments/zalopay/webhook`,
          return_url: `${process.env.SOCKET_SERVER_URL}/api/v1/payments/zalopay/callback`,
        },
      );

      return response.data;
    } catch (error) {
      throw new Error(`ZaloPay payment creation failed: ${error.message}`);
    }
  }
}

export default {
  MomoPaymentService,
  VNPaymentService,
  ZaloPaymentService,
};
