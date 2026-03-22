import axios from "axios";
import crypto from "crypto";

const MOMO_CREATE_ENDPOINT =
  process.env.MOMO_CREATE_ENDPOINT || "https://test-payment.momo.vn/v2/gateway/api/create";
const MOMO_QUERY_ENDPOINT =
  process.env.MOMO_QUERY_ENDPOINT || "https://test-payment.momo.vn/v2/gateway/api/query";

const buildMomoSignature = (rawSignature, secretKey) =>
  crypto.createHmac("sha256", secretKey).update(rawSignature).digest("hex");

const buildMockSandboxPayUrl = ({
  redirectUrl,
  orderId,
  requestId,
  amount,
}) => {
  try {
    const parsedReturnUrl = new URL(redirectUrl);
    const sandboxUrl = new URL(`${parsedReturnUrl.origin}/payment/momo-sandbox`);
    sandboxUrl.searchParams.set("orderId", orderId);
    sandboxUrl.searchParams.set("requestId", requestId);
    sandboxUrl.searchParams.set("amount", String(amount));
    sandboxUrl.searchParams.set("returnUrl", redirectUrl);
    return sandboxUrl.toString();
  } catch {
    const separator = redirectUrl.includes("?") ? "&" : "?";
    return `${redirectUrl}${separator}resultCode=1005&message=${encodeURIComponent("Mock MoMo sandbox URL invalid")}&orderId=${encodeURIComponent(orderId)}&requestId=${encodeURIComponent(requestId)}`;
  }
};

const createMockMomoResponse = ({
  orderId,
  requestId,
  amount,
  redirectUrl,
}) => {
  const payUrl = buildMockSandboxPayUrl({
    redirectUrl,
    orderId,
    requestId,
    amount,
  });

  return {
    partnerCode: "MOCK_PARTNER",
    orderId,
    requestId,
    amount,
    resultCode: 0,
    message: "Mock MoMo checkout initiated",
    payUrl,
    deeplink: payUrl,
    qrCodeUrl: payUrl,
    transId: null,
    isMock: true,
  };
};

// MoMo Payment API (sandbox/test)
export class MomoPaymentService {
  static async createPayment(payload = {}) {
    const {
      orderId,
      amount,
      orderInfo = "",
      redirectUrl = "",
      ipnUrl = "",
      requestId = "",
      extraData = "",
      requestType = "payWithMethod",
      paymentCode = "",
      orderGroupId = "",
      autoCapture = true,
      lang = "vi",
      partnerName = process.env.MOMO_PARTNER_NAME || "Rioshop Test",
      storeId = process.env.MOMO_STORE_ID || "RioshopStore",
    } = payload;

    const partnerCode = process.env.MOMO_PARTNER_CODE;
    const accessKey = process.env.MOMO_ACCESS_KEY;
    const secretKey = process.env.MOMO_SECRET_KEY;
    const amountNumber = Math.max(0, Math.round(Number(amount || 0)));
    const normalizedRequestId = requestId || `${orderId}_${Date.now()}`;

    if (!partnerCode || !accessKey || !secretKey) {
      return createMockMomoResponse({
        orderId,
        requestId: normalizedRequestId,
        amount: amountNumber,
        redirectUrl,
      });
    }

    const rawSignature =
      `accessKey=${accessKey}` +
      `&amount=${amountNumber}` +
      `&extraData=${extraData}` +
      `&ipnUrl=${ipnUrl}` +
      `&orderId=${orderId}` +
      `&orderInfo=${orderInfo}` +
      `&partnerCode=${partnerCode}` +
      `&redirectUrl=${redirectUrl}` +
      `&requestId=${normalizedRequestId}` +
      `&requestType=${requestType}`;

    const signature = buildMomoSignature(rawSignature, secretKey);

    const momoPayload = {
      partnerCode,
      partnerName,
      storeId,
      accessKey,
      requestId: normalizedRequestId,
      amount: String(amountNumber),
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      requestType,
      paymentCode,
      extraData,
      orderGroupId,
      lang,
      autoCapture,
      signature,
    };

    try {
      const response = await axios.post(MOMO_CREATE_ENDPOINT, momoPayload, {
        timeout: 20000,
      });
      return response.data;
    } catch (error) {
      throw new Error(`Momo payment creation failed: ${error.message}`);
    }
  }

  static async verifyPayment(payload = {}) {
    const { orderId, requestId = `${orderId}_${Date.now()}` } = payload;
    const partnerCode = process.env.MOMO_PARTNER_CODE;
    const accessKey = process.env.MOMO_ACCESS_KEY;
    const secretKey = process.env.MOMO_SECRET_KEY;

    if (!partnerCode || !accessKey || !secretKey) {
      return {
        orderId,
        requestId,
        resultCode: 0,
        message: "Mock MoMo verification success",
        isMock: true,
      };
    }

    const rawSignature =
      `accessKey=${accessKey}` +
      `&orderId=${orderId}` +
      `&partnerCode=${partnerCode}` +
      `&requestId=${requestId}`;
    const signature = buildMomoSignature(rawSignature, secretKey);

    try {
      const response = await axios.post(
        MOMO_QUERY_ENDPOINT,
        {
          partnerCode,
          accessKey,
          requestId,
          orderId,
          lang: "vi",
          signature,
        },
        { timeout: 20000 },
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
      const vnpUrl = "https://sandbox.vnpayment.vn/paygate";

      return {
        paymentUrl: vnpUrl,
        orderId,
        amount,
        returnUrl,
      };
    } catch (error) {
      throw new Error(`VNPay payment creation failed: ${error.message}`);
    }
  }
}

// ZaloPay Payment API
export class ZaloPaymentService {
  static async createPayment(orderId, amount, callbackUrl = "", returnUrl = "") {
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
          callback_url: callbackUrl,
          return_url: returnUrl,
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
