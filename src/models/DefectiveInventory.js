import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const defectiveTimelineSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: "" },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    byName: { type: String, default: "" },
  },
  { _id: false },
);

const defectiveInventorySchema = new mongoose.Schema({
  sourceType: { type: String, enum: ["exchange_return", "manual"], default: "exchange_return" },
  sourceOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
  sourceOrderNumber: { type: String, default: "", index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  productNameSnapshot: { type: String, required: true },
  variantSku: { type: String, required: true },
  variantLabelSnapshot: { type: String, required: true },
  image: { type: String, default: "" },
  quantity: { type: Number, required: true, min: 1 },
  reason: { type: String, default: "" },
  evidenceImages: [String],
  status: {
    type: String,
    enum: ["pending_inspection", "under_repair", "restocked", "returned_supplier", "destroyed"],
    default: "pending_inspection",
    index: true,
  },
  warehouseId: { type: String, required: true },
  warehouseName: { type: String, required: true },
  locationLabel: { type: String, default: "Khu hàng lỗi" },
  resolutionNote: { type: String, default: "" },
  resolvedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  createdByName: { type: String, default: "" },
  timeline: [defectiveTimelineSchema],
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
});

defectiveInventorySchema.plugin(mongoosePaginate);
defectiveInventorySchema.index({ productId: 1, variantSku: 1, createdAt: -1 });
defectiveInventorySchema.index(
  { sourceOrderId: 1, variantSku: 1 },
  { unique: true, partialFilterExpression: { sourceOrderId: { $type: "objectId" } } },
);

export default mongoose.model("DefectiveInventory", defectiveInventorySchema);
