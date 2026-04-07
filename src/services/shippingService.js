import axios from "axios";
import { AppError } from "../utils/helpers.js";

const GHN_API_BASE_URL =
  process.env.GHN_API_BASE_URL || "https://dev-online-gateway.ghn.vn/shiip/public-api";
const GHN_MASTER_DATA_BASE_URL =
  process.env.GHN_MASTER_DATA_BASE_URL || `${GHN_API_BASE_URL}/master-data`;
const GHN_TIMEOUT_MS = Number(process.env.GHN_TIMEOUT_MS || 15000);
const SHIPPING_METHODS = ["standard", "express", "same_day"];
const DEFAULT_FREE_SHIP_THRESHOLD = 299000;
const DEFAULT_FREE_SHIP_METHODS = ["standard", "express"];
const DEFAULT_SAME_DAY_FLAT_FEE = 45000;
const DEFAULT_GHN_STANDARD_FALLBACK_FEE = 20000;
const DEFAULT_GHN_EXPRESS_FALLBACK_FEE = 30000;

const normalizeMoney = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Math.max(0, Math.round(Number(fallback) || 0));
  }
  return Math.max(0, Math.round(parsed));
};

const normalizeBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = value.toString().trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
};

const parseMethodList = (value, fallback = []) => {
  const source =
    value === undefined || value === null || value === ""
      ? fallback.join(",")
      : value.toString();

  return source
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => SHIPPING_METHODS.includes(item));
};

const clampNumber = (value, min, max) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(num)));
};

const parseGhnApiError = (prefix, error) => {
  const status = Number(error?.response?.status || 0);
  const data = error?.response?.data || {};
  const message =
    data?.message ||
    data?.msg ||
    data?.error_message ||
    error?.message ||
    "Unknown GHN error";
  const code = data?.code || data?.resultCode;
  return new AppError(
    `${prefix}: ${message}${code !== undefined ? ` (code: ${code})` : ""}`,
    status || 502,
  );
};

const normalizeVietnameseSearchText = (value = "") =>
  value
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const isWarehouseLookupError = (error) => {
  const rawMessage = error?.response?.data?.message || error?.message || "";
  const message = normalizeVietnameseSearchText(rawMessage);

  return (
    message.includes("khong lay duoc thong tin kho") ||
    message.includes("khong tim thay dia chi shop") ||
    message.includes("khong tim thay kho")
  );
};

// GHN Shipping API
export class GHNShippingService {
  static isConfigured() {
    return Boolean(process.env.GHN_API_KEY && process.env.GHN_SHOP_ID);
  }

  static getHeaders({ includeShopId = true } = {}) {
    const headers = {
      Token: process.env.GHN_API_KEY || "",
      "Content-Type": "application/json",
    };

    if (includeShopId) {
      headers.ShopId = String(process.env.GHN_SHOP_ID || "");
    }

    return headers;
  }

  static assertConfigured() {
    if (!this.isConfigured()) {
      throw new AppError("GHN is not configured. Missing GHN_API_KEY or GHN_SHOP_ID", 500);
    }
  }

  static getSenderConfig() {
    const fromDistrictId = Number(process.env.GHN_FROM_DISTRICT_ID || 0);
    const fromWardCode = (process.env.GHN_FROM_WARD_CODE || "").trim();
    const fromName = (process.env.GHN_FROM_NAME || "RioShop").trim();
    const fromPhone = (process.env.GHN_FROM_PHONE || "0867717003").trim();
    const fromAddress = (
      process.env.GHN_FROM_ADDRESS || "64 Ng. 68 Duong Phu Dien, Phu Dien, Bac Tu Liem, Ha Noi"
    ).trim();

    if (!fromDistrictId || !fromWardCode) {
      throw new AppError(
        "Missing GHN sender location. Please set GHN_FROM_DISTRICT_ID and GHN_FROM_WARD_CODE in .env",
        500,
      );
    }

    return {
      fromDistrictId,
      fromWardCode,
      fromName,
      fromPhone,
      fromAddress,
    };
  }

  static mapShippingMethodToServiceType(shippingMethod = "standard") {
    if (shippingMethod === "express") {
      return 1;
    }
    return 2;
  }

  static normalizeShippingMethod(shippingMethod = "standard") {
    const normalized = (shippingMethod || "").toString().trim().toLowerCase();
    if (SHIPPING_METHODS.includes(normalized)) {
      return normalized;
    }
    return "standard";
  }

  static getShippingPolicy() {
    const freeShipMethods = parseMethodList(
      process.env.FREE_SHIP_METHODS,
      DEFAULT_FREE_SHIP_METHODS,
    );

    return {
      freeShipEnabled: normalizeBoolean(process.env.FREE_SHIP_ENABLED, true),
      freeShipThreshold: normalizeMoney(
        process.env.FREE_SHIP_THRESHOLD,
        DEFAULT_FREE_SHIP_THRESHOLD,
      ),
      freeShipEligibleMethods: freeShipMethods.length > 0 ? freeShipMethods : DEFAULT_FREE_SHIP_METHODS,
      sameDayFlatFee: normalizeMoney(
        process.env.SAME_DAY_FLAT_FEE,
        DEFAULT_SAME_DAY_FLAT_FEE,
      ),
      ghnFallbackStandardFee: normalizeMoney(
        process.env.GHN_FALLBACK_STANDARD_FEE,
        DEFAULT_GHN_STANDARD_FALLBACK_FEE,
      ),
      ghnFallbackExpressFee: normalizeMoney(
        process.env.GHN_FALLBACK_EXPRESS_FEE,
        DEFAULT_GHN_EXPRESS_FALLBACK_FEE,
      ),
    };
  }

  static getSameDayFlatFee() {
    const policy = this.getShippingPolicy();
    return policy.sameDayFlatFee;
  }

  static getGhnFallbackFee(shippingMethod = "standard") {
    const policy = this.getShippingPolicy();
    const normalizedMethod = this.normalizeShippingMethod(shippingMethod);
    if (normalizedMethod === "express") {
      return policy.ghnFallbackExpressFee;
    }
    return policy.ghnFallbackStandardFee;
  }

  static calculateShippingQuote(payload = {}) {
    const policy = this.getShippingPolicy();
    const shippingMethod = this.normalizeShippingMethod(payload.shippingMethod);
    const subtotal = normalizeMoney(payload.subtotal || payload.insuranceValue || 0);
    const rawShippingFee = normalizeMoney(payload.rawShippingFee || payload.totalFee || 0);
    const threshold = normalizeMoney(policy.freeShipThreshold, DEFAULT_FREE_SHIP_THRESHOLD);
    const isMethodEligible = policy.freeShipEligibleMethods.includes(shippingMethod);
    const isFreeShipEnabled = policy.freeShipEnabled && isMethodEligible && threshold >= 0;
    const isEligibleForFreeShip = isFreeShipEnabled && subtotal >= threshold;
    const freeShipDiscount = isEligibleForFreeShip ? rawShippingFee : 0;
    const shippingFeePayable = Math.max(0, rawShippingFee - freeShipDiscount);
    const remainingToFreeShip = isFreeShipEnabled ? Math.max(0, threshold - subtotal) : 0;
    const freeShipProgress =
      isFreeShipEnabled && threshold > 0
        ? Math.min(100, Math.round((subtotal / threshold) * 100))
        : isEligibleForFreeShip
          ? 100
          : 0;

    return {
      shippingMethod,
      subtotal,
      rawShippingFee,
      shippingFeePayable,
      freeShipDiscount,
      isEligibleForFreeShip,
      remainingToFreeShip,
      freeShipProgress,
      freeShipApplicableMethod: isMethodEligible,
      ...policy,
    };
  }

  static buildFeeQuote(fee = {}, payload = {}) {
    const shippingMethod = this.normalizeShippingMethod(payload.shippingMethod);
    const quote = this.calculateShippingQuote({
      shippingMethod,
      subtotal: payload.subtotal ?? payload.insuranceValue ?? 0,
      rawShippingFee: fee.totalFee,
    });

    return {
      ...fee,
      ...quote,
    };
  }

  static normalizePackageProfile(profile = {}) {
    return {
      weight: clampNumber(profile.weight, 100, 50000),
      length: clampNumber(profile.length, 10, 200),
      width: clampNumber(profile.width, 10, 200),
      height: clampNumber(profile.height, 1, 200),
    };
  }

  static readNumericFee(ghnData = {}) {
    const feeCandidates = [
      ghnData.total,
      ghnData.total_fee,
      ghnData.service_fee,
      ghnData.main_service,
      ghnData.totalFee,
      ghnData.total_fee_amount,
    ];

    const found = feeCandidates.find((value) => Number.isFinite(Number(value)));
    return Number(found || 0);
  }

  static async getProvinces() {
    this.assertConfigured();
    try {
      const response = await axios.get(`${GHN_MASTER_DATA_BASE_URL}/province`, {
        headers: this.getHeaders({ includeShopId: false }),
        timeout: GHN_TIMEOUT_MS,
      });
      return response.data?.data || [];
    } catch (error) {
      throw parseGhnApiError("GHN provinces lookup failed", error);
    }
  }

  static async getDistricts(provinceId) {
    this.assertConfigured();
    try {
      const response = await axios.post(
        `${GHN_MASTER_DATA_BASE_URL}/district`,
        { province_id: Number(provinceId) },
        {
          headers: this.getHeaders({ includeShopId: false }),
          timeout: GHN_TIMEOUT_MS,
        },
      );
      return response.data?.data || [];
    } catch (error) {
      throw parseGhnApiError("GHN districts lookup failed", error);
    }
  }

  static async getWards(districtId) {
    this.assertConfigured();
    try {
      const response = await axios.get(`${GHN_MASTER_DATA_BASE_URL}/ward`, {
        params: { district_id: Number(districtId) },
        headers: this.getHeaders({ includeShopId: false }),
        timeout: GHN_TIMEOUT_MS,
      });
      return response.data?.data || [];
    } catch (error) {
      throw parseGhnApiError("GHN wards lookup failed", error);
    }
  }

  static async calculateFee(payload = {}) {
    this.assertConfigured();
    const sender = this.getSenderConfig();
    const toDistrictId = Number(payload.toDistrictId || payload.recipientDistrictId || 0);
    const toWardCode = (payload.toWardCode || payload.recipientWardCode || "").toString().trim();

    if (!toDistrictId || !toWardCode) {
      throw new AppError("GHN fee calculation requires toDistrictId and toWardCode", 400);
    }

    const packageProfile = this.normalizePackageProfile(payload.packageProfile || payload);
    const requestBody = {
      shop_id: Number(process.env.GHN_SHOP_ID || 0),
      from_district_id: sender.fromDistrictId,
      from_ward_code: sender.fromWardCode,
      service_type_id: this.mapShippingMethodToServiceType(payload.shippingMethod),
      to_district_id: toDistrictId,
      to_ward_code: toWardCode,
      weight: packageProfile.weight,
      length: packageProfile.length,
      width: packageProfile.width,
      height: packageProfile.height,
      insurance_value: Math.max(0, Number(payload.insuranceValue || 0)),
      cod_failed_amount: 0,
      coupon: null,
    };

    try {
      const response = await axios.post(
        `${GHN_API_BASE_URL}/v2/shipping-order/fee`,
        requestBody,
        {
          headers: this.getHeaders({ includeShopId: true }),
          timeout: GHN_TIMEOUT_MS,
        },
      );

      const ghnData = response.data?.data || {};
      return {
        totalFee: this.readNumericFee(ghnData),
        data: ghnData,
        raw: response.data,
      };
    } catch (error) {
      throw parseGhnApiError("GHN shipping fee calculation failed", error);
    }
  }

  static async createShipment(orderData) {
    this.assertConfigured();
    const sender = this.getSenderConfig();
    const toDistrictId = Number(orderData.recipientDistrictId || 0);
    const toWardCode = (orderData.recipientWardCode || "").toString().trim();
    if (!toDistrictId || !toWardCode) {
      throw new AppError("Missing recipient district/ward for GHN shipment", 400);
    }

    const packageProfile = this.normalizePackageProfile(orderData);
    const serviceTypeId = this.mapShippingMethodToServiceType(orderData.shippingMethod);

    try {
      const response = await axios.post(
        `${GHN_API_BASE_URL}/v2/shipping-order/create`,
        {
          payment_type_id: Number(orderData.codAmount || 0) > 0 ? 2 : 1,
          required_note: "KHONGCHOXEMHANG",
          service_type_id: serviceTypeId,
          from_name: orderData.senderName || sender.fromName,
          from_phone: orderData.senderPhone || sender.fromPhone,
          from_address: orderData.senderAddress || sender.fromAddress,
          from_ward_code: orderData.senderWardCode || sender.fromWardCode,
          from_district_id: Number(orderData.senderDistrictId || sender.fromDistrictId),
          to_name: orderData.recipientName,
          to_phone: orderData.recipientPhone,
          to_address: orderData.recipientAddress,
          to_ward_code: toWardCode,
          to_district_id: toDistrictId,
          weight: packageProfile.weight,
          length: packageProfile.length,
          width: packageProfile.width,
          height: packageProfile.height,
          cod_amount: orderData.codAmount || 0,
          insurance_value: Math.max(0, Number(orderData.insuranceValue || 0)),
          content: orderData.content || "RioShop order",
          note: orderData.note || "",
          client_order_code: orderData.clientOrderCode || "",
          items: Array.isArray(orderData.items) ? orderData.items : [],
        },
        {
          headers: this.getHeaders({ includeShopId: true }),
          timeout: GHN_TIMEOUT_MS,
        },
      );

      return response.data;
    } catch (error) {
      if (isWarehouseLookupError(error)) {
        throw new AppError(
          "GHN chua lay duoc thong tin kho cua shop. Hay vao GHN 5Sao > Quan ly cua hang, cap nhat lai dia chi kho mac dinh va xac thuc tai khoan shop, sau do thu lai.",
          400,
        );
      }
      throw parseGhnApiError("GHN shipment creation failed", error);
    }
  }

  static async trackShipment(orderCode) {
    this.assertConfigured();
    try {
      const response = await axios.post(
        `${GHN_API_BASE_URL}/v2/shipping-order/detail`,
        { order_code: orderCode },
        {
          headers: this.getHeaders({ includeShopId: true }),
          timeout: GHN_TIMEOUT_MS,
        },
      );

      return response.data;
    } catch (error) {
      throw parseGhnApiError("GHN tracking failed", error);
    }
  }
}

export default {
  GHNShippingService,
};
