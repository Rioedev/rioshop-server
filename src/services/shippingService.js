import axios from "axios";

// GHN Shipping API
export class GHNShippingService {
  static async createShipment(orderData) {
    try {
      const response = await axios.post(
        "https://dev-online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/create",
        {
          service_type_id: 2,
          from_name: orderData.senderName,
          from_phone: orderData.senderPhone,
          from_address: orderData.senderAddress,
          from_ward_code: orderData.senderWardCode,
          from_district_id: orderData.senderDistrictId,
          to_name: orderData.recipientName,
          to_phone: orderData.recipientPhone,
          to_address: orderData.recipientAddress,
          to_ward_code: orderData.recipientWardCode,
          to_district_id: orderData.recipientDistrictId,
          weight: orderData.weight,
          length: orderData.length,
          width: orderData.width,
          height: orderData.height,
          cod_amount: orderData.codAmount || 0,
          content: orderData.content,
          note: orderData.note,
          items: orderData.items,
        },
        {
          headers: {
            Token: process.env.GHN_API_KEY,
            ShopId: process.env.GHN_SHOP_ID,
          },
        },
      );

      return response.data;
    } catch (error) {
      throw new Error(`GHN shipment creation failed: ${error.message}`);
    }
  }

  static async trackShipment(orderCode) {
    try {
      const response = await axios.post(
        "https://dev-online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/detail",
        { order_code: orderCode },
        {
          headers: {
            Token: process.env.GHN_API_KEY,
            ShopId: process.env.GHN_SHOP_ID,
          },
        },
      );

      return response.data;
    } catch (error) {
      throw new Error(`GHN tracking failed: ${error.message}`);
    }
  }
}

// GHTK Shipping API
export class GHTKShippingService {
  static async createShipment(orderData) {
    try {
      const response = await axios.post(
        "https://khachhang.ghtk.vn/api/shipment/order",
        {
          products: orderData.items,
          order: {
            id: orderData.orderId,
            title: orderData.title,
            weight: orderData.weight,
            transport_type: 2,
            pick_session: "PT001",
            value: orderData.totalAmount,
            note: orderData.note,
            receiver_name: orderData.recipientName,
            receiver_phone: orderData.recipientPhone,
            receiver_address: orderData.recipientAddress,
            receiver_province: orderData.recipientProvince,
            receiver_district: orderData.recipientDistrict,
            receiver_ward: orderData.recipientWard,
            cod: orderData.codAmount || 0,
          },
        },
        {
          headers: {
            Token: process.env.GHTK_API_KEY,
          },
        },
      );

      return response.data;
    } catch (error) {
      throw new Error(`GHTK shipment creation failed: ${error.message}`);
    }
  }

  static async trackShipment(trackingCode) {
    try {
      const response = await axios.get(
        `https://khachhang.ghtk.vn/api/shipment/v2/${trackingCode}`,
        {
          headers: {
            Token: process.env.GHTK_API_KEY,
          },
        },
      );

      return response.data;
    } catch (error) {
      throw new Error(`GHTK tracking failed: ${error.message}`);
    }
  }
}

// Viettel Post Shipping API
export class ViettelPostShippingService {
  static async createShipment(orderData) {
    try {
      const response = await axios.post(
        "https://api.viettelpost.vn/api/order",
        {
          ORDER_NUMBER: orderData.orderId,
          CUST_ID: process.env.VIETTEL_CUSTOMER_ID,
          SENDER_FULLNAME: orderData.senderName,
          SENDER_PHONE: orderData.senderPhone,
          SENDER_ADDRESS: orderData.senderAddress,
          RECEIVER_FULLNAME: orderData.recipientName,
          RECEIVER_PHONE: orderData.recipientPhone,
          RECEIVER_ADDRESS: orderData.recipientAddress,
          PRODUCT_WEIGHT: orderData.weight,
          PRODUCT_PRICE: orderData.totalAmount,
          PRODUCT_TYPE: "Normal",
          NOTE: orderData.note,
          MONEY_COLLECTION: orderData.codAmount || 0,
        },
        {
          headers: {
            Token: process.env.VIETTEL_API_KEY,
          },
        },
      );

      return response.data;
    } catch (error) {
      throw new Error(
        `Viettel Post shipment creation failed: ${error.message}`,
      );
    }
  }

  static async trackShipment(trackingCode) {
    try {
      const response = await axios.get(
        `https://api.viettelpost.vn/api/tracking/${trackingCode}`,
        {
          headers: {
            Token: process.env.VIETTEL_API_KEY,
          },
        },
      );

      return response.data;
    } catch (error) {
      throw new Error(`Viettel Post tracking failed: ${error.message}`);
    }
  }
}

export default {
  GHNShippingService,
  GHTKShippingService,
  ViettelPostShippingService,
};
