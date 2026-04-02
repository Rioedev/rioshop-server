import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const collectionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true },
  description: String,
  image: String,
  bannerImage: String,
  position: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  startsAt: Date,
  endsAt: Date,
  deletedAt: { type: Date, default: null },
  seoMeta: {
    title: String,
    description: String,
    keywords: [String],
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

collectionSchema.plugin(mongoosePaginate);

collectionSchema.index(
  { slug: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  },
);
collectionSchema.index({ isActive: 1, position: 1 });
collectionSchema.index({ startsAt: 1, endsAt: 1 });
collectionSchema.index({ deletedAt: 1 });

export default mongoose.model("Collection", collectionSchema);
