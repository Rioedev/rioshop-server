import mongoose from "mongoose";
import { ADMIN_ALL_ROLES } from "../constants/index.js";

const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  fullName: { type: String, required: true },
  avatar: String,
  role: {
    type: String,
    enum: ADMIN_ALL_ROLES,
    required: true,
  },
  permissions: [String],
  warehouseIds: [String],
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  lastLoginAt: Date,
  loginHistory: [
    {
      ip: String,
      ua: String,
      at: Date,
    },
  ],
  createdBy: mongoose.Schema.Types.ObjectId,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes
// adminSchema.index({ email: 1 });
adminSchema.index({ role: 1, isDeleted: 1, isActive: 1, createdAt: 1 });

export default mongoose.model("Admin", adminSchema);
