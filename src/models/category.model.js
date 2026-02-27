// models/Category.js
import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
    },

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    description: String,

    image: {
      url: String,
      public_id: String,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

categorySchema.index({ slug: 1 });
categorySchema.index({ parentId: 1 });
categorySchema.plugin(mongoosePaginate);

export default mongoose.model("Category", categorySchema);
