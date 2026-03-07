import mongoose from "mongoose";

const shipmentEventSchema = new mongoose.Schema(
  {
    status: String,
    location: String,
    note: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const shipmentSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  carrier: {
    type: String,
    enum: ["GHN", "GHTK", "Viettel Post"],
    required: true,
  },
  trackingCode: { type: String, required: true },
  trackingUrl: String,
  status: {
    type: String,
    enum: [
      "ready",
      "picked_up",
      "in_transit",
      "out_for_delivery",
      "delivered",
      "failed",
      "returned",
    ],
    default: "ready",
  },
  events: [shipmentEventSchema],
  estimatedDelivery: Date,
  deliveredAt: Date,
  recipientName: { type: String, required: true },
  recipientPhone: { type: String, required: true },
  shippingAddress: mongoose.Schema.Types.Mixed,
  weight: Number,
  codAmount: Number,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes
shipmentSchema.index({ orderId: 1 });
shipmentSchema.index({ trackingCode: 1 });
shipmentSchema.index({ status: 1 });

export default mongoose.model("Shipment", shipmentSchema);
