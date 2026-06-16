import { asyncHandler, sendSuccess } from "../utils/helpers.js";
import inventoryAdjustmentService from "../services/inventoryAdjustmentService.js";
import Admin from "../models/Admin.js";

const buildAdminContext = async (req) => {
  const adminId = req.user?.adminId || null;
  let adminName = req.user?.fullName || req.user?.email || "";

  if (adminId && !adminName) {
    const admin = await Admin.findById(adminId).select("fullName email").lean();
    adminName = admin?.fullName || admin?.email || "";
  }

  return { adminId, adminName };
};

export const adjustInventory = asyncHandler(async (req, res) => {
  const result = await inventoryAdjustmentService.adjust(await buildAdminContext(req), req.body);
  sendSuccess(res, 201, result, "Đã điều chỉnh tồn kho");
});

export const listInventoryAdjustments = asyncHandler(async (req, res) => {
  const { page, limit, productId, reason, from, to } = req.query;
  const result = await inventoryAdjustmentService.list({ page, limit, productId, reason, from, to });
  sendSuccess(res, 200, result, "OK");
});
