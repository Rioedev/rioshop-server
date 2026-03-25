import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const blogSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true },
  excerpt: { type: String, default: "" },
  content: { type: String, default: "" },
  coverImage: { type: String, default: "" },
  tags: [{ type: String, trim: true }],
  authorName: { type: String, default: "RioShop" },
  isPublished: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  publishedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

blogSchema.plugin(mongoosePaginate);

blogSchema.index(
  { slug: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  },
);
blogSchema.index({ isPublished: 1, publishedAt: -1 });
blogSchema.index({ isFeatured: 1, publishedAt: -1 });
blogSchema.index({ deletedAt: 1 });

export default mongoose.model("Blog", blogSchema);
