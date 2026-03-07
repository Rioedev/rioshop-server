import mongoose from "mongoose";

const flashSaleSlotSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantSku: String,
    salePrice: { type: Number, required: true },
    stockLimit: { type: Number, required: true },
    sold: { type: Number, default: 0 },
  },
  { _id: false },
);

const flashSaleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  banner: String,
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  slots: [flashSaleSlotSchema],
  isActive: { type: Boolean, default: true },
  createdBy: mongoose.Schema.Types.ObjectId,
  createdAt: { type: Date, default: Date.now },
});

// Indexes
flashSaleSchema.index({ isActive: 1, startsAt: 1, endsAt: 1 });

export default mongoose.model("FlashSale", flashSaleSchema);
