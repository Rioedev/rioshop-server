import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

// Lịch sử nhập kho — 1 record / 1 variant trong 1 phiếu nhập.
// Một phiếu nhập (cùng supplier + 1 lần bấm Lưu) sinh ra nhiều adjustment
// gắn với cùng `batchId` để dễ tra cứu lại "phiếu nhập đó nhập những gì".
const inventoryAdjustmentSchema = new mongoose.Schema({
  batchId: { type: String, required: true, index: true },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  productNameSnapshot: { type: String, default: "" },
  variantSku: { type: String, required: true },
  variantLabelSnapshot: { type: String, default: "" },
  // Nguồn gốc của lần điều chỉnh — phục vụ báo cáo & audit
  reason: {
    type: String,
    enum: ["purchase_receipt", "stocktake_diff", "damaged", "lost", "other"],
    default: "purchase_receipt",
    index: true,
  },
  purchaseOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PurchaseOrder",
    default: null,
  },
  qtyDelta: { type: Number, required: true }, // dương = nhập vào, âm = điều chỉnh giảm
  unitCost: { type: Number, default: 0 }, // giá vốn / cái cho dòng này
  // Snapshot stock + cost trước và sau lần điều chỉnh — phục vụ audit/báo cáo
  stockBefore: { type: Number, default: 0 },
  stockAfter: { type: Number, default: 0 },
  costBefore: { type: Number, default: 0 },
  costAfter: { type: Number, default: 0 },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
  supplierName: { type: String, default: "" },
  note: { type: String, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  createdByName: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now, index: true },
});

inventoryAdjustmentSchema.plugin(mongoosePaginate);

inventoryAdjustmentSchema.index({ productId: 1, createdAt: -1 });
inventoryAdjustmentSchema.index({ supplierId: 1, createdAt: -1 });

export default mongoose.model("InventoryAdjustment", inventoryAdjustmentSchema);
