import mongoose from "mongoose";
import connectDB from "../src/config/database.js";
import Order from "../src/models/Order.js";
import Shipment from "../src/models/Shipment.js";
import { GHNShippingService } from "../src/services/shippingService.js";

const applyChanges = process.argv.includes("--apply");

const resolveCustomerPaidFee = (order) => {
  const subtotal = Math.max(0, Number(order?.pricing?.subtotal || 0));
  const shippingFee = Math.max(0, Number(order?.pricing?.shippingFee || 0));
  const discount = Math.max(0, Number(order?.pricing?.discount || 0));
  const merchandiseDiscount =
    order?.couponType === "free_ship" ? 0 : Math.min(subtotal, discount);
  const shippingDiscount =
    order?.couponType === "free_ship"
      ? discount
      : Math.max(0, discount - merchandiseDiscount);

  return Math.max(0, shippingFee - shippingDiscount);
};

const run = async () => {
  await connectDB();
  GHNShippingService.assertConfigured();

  const shipments = await Shipment.find({
    carrier: "GHN",
    trackingCode: { $exists: true, $ne: "" },
    $or: [
      { feeStatus: { $exists: false } },
      { feeStatus: { $ne: "confirmed" } },
      { carrierFee: { $exists: false } },
      { carrierFee: { $lte: 0 } },
    ],
  }).select("_id orderId trackingCode quotedFee carrierFee customerPaidFee feeStatus");

  let found = 0;
  let updated = 0;
  let missingFee = 0;
  let failed = 0;

  for (const shipment of shipments) {
    try {
      const detail = await GHNShippingService.trackShipment(shipment.trackingCode);
      const carrierFee = GHNShippingService.readConfirmedShippingFee(detail);
      if (carrierFee <= 0) {
        missingFee += 1;
        continue;
      }

      const order = await Order.findById(shipment.orderId).select(
        "pricing couponType couponDiscount",
      );
      if (!order?.pricing) {
        failed += 1;
        continue;
      }

      found += 1;
      const customerPaidFee =
        order.pricing.shippingFeeStatus === "legacy"
          ? resolveCustomerPaidFee(order)
          : Math.max(0, Number(order.pricing.shippingCustomerPaid || 0));
      const quotedFee = Math.max(
        0,
        Number(shipment.quotedFee || order.pricing.shippingQuotedFee || carrierFee),
      );
      const shopSubsidy = Math.max(0, carrierFee - customerPaidFee);

      if (!applyChanges) continue;

      shipment.quotedFee = quotedFee;
      shipment.carrierFee = carrierFee;
      shipment.customerPaidFee = customerPaidFee;
      shipment.shopSubsidy = shopSubsidy;
      shipment.feeStatus = "confirmed";
      shipment.updatedAt = new Date();

      order.pricing.shippingQuotedFee = quotedFee;
      order.pricing.shippingCarrierFee = carrierFee;
      order.pricing.shippingCustomerPaid = customerPaidFee;
      order.pricing.shippingSubsidy = shopSubsidy;
      order.pricing.shippingFeeStatus = "confirmed";
      order.updatedAt = new Date();

      await Promise.all([shipment.save(), order.save()]);
      updated += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `[shipping-fee-backfill] ${shipment.trackingCode}: ${error?.message || error}`,
      );
    }
  }

  console.log({
    mode: applyChanges ? "apply" : "dry-run",
    scanned: shipments.length,
    found,
    updated,
    missingFee,
    failed,
  });
};

try {
  await run();
} finally {
  await mongoose.disconnect();
}
