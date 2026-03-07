import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: String,
  parentId: mongoose.Schema.Types.ObjectId,
  ancestors: [
    {
      _id: mongoose.Schema.Types.ObjectId,
      name: String,
      slug: String,
    },
  ],
  level: { type: Number, required: true, default: 0 },
  path: { type: String, required: true },
  image: String,
  icon: String,
  position: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  productCount: { type: Number, default: 0 },
  seoMeta: {
    title: String,
    description: String,
    keywords: [String],
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes
categorySchema.index({ slug: 1 });
categorySchema.index({ parentId: 1, position: 1 });
categorySchema.index({ path: 1 });
categorySchema.index({ isActive: 1 });

export default mongoose.model("Category", categorySchema);
