import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

// Nhà cung cấp — danh sách đơn giản để admin chọn khi nhập kho.
// Không có order/payment workflow phức tạp — chỉ là master data.
const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // internal = xưởng / chi nhánh do shop tự vận hành (sản xuất nội bộ)
  // external = bên thứ 3 (mua ngoài, gia công, đối tác)
  type: { type: String, enum: ["internal", "external"], default: "external", index: true },
  phone: { type: String, trim: true, default: "" },
  email: { type: String, trim: true, default: "" },
  address: { type: String, trim: true, default: "" },
  note: { type: String, trim: true, default: "" },
  isActive: { type: Boolean, default: true },
  deletedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

supplierSchema.plugin(mongoosePaginate);

supplierSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
supplierSchema.index({ isActive: 1, name: 1 });

export default mongoose.model("Supplier", supplierSchema);
