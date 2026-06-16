import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

// Phiếu đặt hàng (PO) — vòng đời:
//   draft → ordered → partially_received → received | cancelled
//   draft → cancelled
//
// "ordered" báo cho hệ thống biết shop đã đặt hàng → variant.incoming += orderedQty
// "received" / "partially_received" cập nhật variant.stock + costPrice (weighted avg)
// "cancelled" sau khi ordered → hoàn lại variant.incoming
//
// Mỗi lần nhập một phần (partial receipt) sẽ:
//   1. Cộng vào line.receivedQty
//   2. Tăng variant.stock += qty, giảm variant.incoming -= qty
//   3. Tính lại costPrice weighted avg cho variant đó
//   4. Tạo 1 InventoryAdjustment record (reason = "purchase_receipt") để audit
//   5. Push 1 entry vào receipts[] để xem lại nhận từng lần khi nào

const poLineSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productNameSnapshot: { type: String, default: "" },
    variantSku: { type: String, required: true },
    variantLabelSnapshot: { type: String, default: "" },
    orderedQty: { type: Number, required: true, min: 1 },
    receivedQty: { type: Number, default: 0, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, default: 0 },
  },
  { _id: false },
);

const receiptEntrySchema = new mongoose.Schema(
  {
    receivedAt: { type: Date, default: Date.now },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    receivedByName: { type: String, default: "" },
    lines: [
      {
        variantSku: { type: String, required: true },
        qty: { type: Number, required: true, min: 1 },
        unitCost: { type: Number, required: true, min: 0 },
        _id: false,
      },
    ],
    note: { type: String, default: "" },
  },
  { _id: false },
);

const timelineEntrySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: "" },
    at: { type: Date, default: Date.now },
    byName: { type: String, default: "" },
  },
  { _id: false },
);

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: { type: String, required: true, unique: true },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Supplier",
    required: true,
  },
  supplierNameSnapshot: { type: String, default: "" },
  supplierType: {
    type: String,
    enum: ["internal", "external"],
    default: "external",
  },
  // Trạng thái:
  //   draft               — nháp, sửa tự do
  //   ordered             — đã đặt NCC, đang chờ hàng
  //   partially_received  — đã nhận một phần
  //   received            — đã nhận đủ (kết thúc bình thường)
  //   cancelled           — hủy KHI CHƯA NHẬN GÌ (từ draft hoặc ordered)
  //   closed              — đóng đơn KHI ĐÃ NHẬN MỘT PHẦN nhưng không nhận tiếp
  //                         (kế toán cần phân biệt với cancelled vì hàng đã về kho)
  status: {
    type: String,
    enum: ["draft", "ordered", "partially_received", "received", "cancelled", "closed"],
    default: "draft",
    index: true,
  },
  expectedDeliveryDate: { type: Date, default: null },
  orderedAt: { type: Date, default: null },
  receivedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  cancelReason: { type: String, default: "" },
  lines: { type: [poLineSchema], default: [] },
  receipts: { type: [receiptEntrySchema], default: [] },
  subtotal: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  note: { type: String, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  createdByName: { type: String, default: "" },
  timeline: { type: [timelineEntrySchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

purchaseOrderSchema.plugin(mongoosePaginate);

purchaseOrderSchema.index({ status: 1, createdAt: -1 });
purchaseOrderSchema.index({ supplierId: 1, createdAt: -1 });
purchaseOrderSchema.index({ "lines.productId": 1 });

export default mongoose.model("PurchaseOrder", purchaseOrderSchema);
