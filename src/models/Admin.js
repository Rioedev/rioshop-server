import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  fullName: { type: String, required: true },
  avatar: String,
  role: {
    type: String,
    enum: ["superadmin", "manager", "warehouse", "cs", "marketer"],
    required: true,
  },
  permissions: [String],
  warehouseIds: [String],
  isActive: { type: Boolean, default: true },
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
adminSchema.index({ email: 1 });

export default mongoose.model("Admin", adminSchema);
