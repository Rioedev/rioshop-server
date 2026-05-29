import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

// Policy is used for two distinct customer-facing surfaces:
// - kind: "strip" → small chips shown across the storefront header strip
//   (e.g. "Miễn phí đổi trả 60 ngày"). Needs title + iconKey + optional summary.
// - kind: "page"  → full long-form policy pages reachable at /chinh-sach/:slug
//   (e.g. shipping policy, privacy policy). Needs title + slug + content (HTML).
const policySchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["strip", "page"],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    slug: { type: String, trim: true, default: "" },
    iconKey: { type: String, trim: true, default: "" },
    summary: { type: String, trim: true, default: "" },
    content: { type: String, default: "" },
    position: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  },
);

policySchema.plugin(mongoosePaginate);

// Slug must be unique among non-deleted page policies. Strips don't use slug.
policySchema.index(
  { kind: 1, slug: 1 },
  {
    unique: true,
    partialFilterExpression: {
      kind: "page",
      deletedAt: null,
      slug: { $type: "string", $ne: "" },
    },
  },
);
policySchema.index({ kind: 1, position: 1 });
policySchema.index({ isActive: 1 });

export default mongoose.model("Policy", policySchema);
