import mongoose from "mongoose";

const wishlistItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productSlug: { type: String, default: "" },
    variantSku: String,
    name: { type: String, required: true },
    image: { type: String, required: true },
    price: { type: Number, required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const wishlistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  items: [wishlistItemSchema],
  updatedAt: { type: Date, default: Date.now },
});

// Indexes
wishlistSchema.index({ "items.productId": 1 });

export default mongoose.model("Wishlist", wishlistSchema);
