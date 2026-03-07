import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  variantSku: { type: String, required: true },
  warehouseId: { type: String, required: true },
  warehouseName: { type: String, required: true },
  onHand: { type: Number, required: true, default: 0 },
  reserved: { type: Number, required: true, default: 0 },
  available: { type: Number, required: true, default: 0 },
  incoming: { type: Number, default: 0 },
  reorderPoint: Number,
  reorderQty: Number,
  lowStockAlert: { type: Boolean, default: false },
  lastCountAt: Date,
  updatedAt: { type: Date, default: Date.now },
});

// Indexes
inventorySchema.index(
  { productId: 1, variantSku: 1, warehouseId: 1 },
  { unique: true },
);
inventorySchema.index({ variantSku: 1 });
inventorySchema.index({ available: 1 });
inventorySchema.index({ lowStockAlert: 1 });

export default mongoose.model("Inventory", inventorySchema);
