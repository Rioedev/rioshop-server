import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantSku: { type: String, required: true },
    productName: { type: String, required: true },
    variantLabel: { type: String, required: true },
    image: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", sparse: true },
  sessionId: { type: String, sparse: true },
  items: [cartItemSchema],
  couponCode: String,
  couponDiscount: Number,
  subtotal: { type: Number, default: 0 },
  note: String,
  expiresAt: Date,
  updatedAt: { type: Date, default: Date.now },
});

// TTL index for guest carts
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
cartSchema.index({ userId: 1 }, { unique: true, sparse: true });
cartSchema.index({ sessionId: 1 }, { unique: true, sparse: true });

export default mongoose.model("Cart", cartSchema);
