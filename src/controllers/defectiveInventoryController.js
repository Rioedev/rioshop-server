import Admin from "../models/Admin.js";
import defectiveInventoryService from "../services/defectiveInventoryService.js";
import { asyncHandler, sendSuccess } from "../utils/helpers.js";

const buildAdminContext = async (req) => {
  const adminId = req.user?.adminId || null;
  let adminName = req.user?.fullName || req.user?.email || "";
  if (adminId && !adminName) {
    const admin = await Admin.findById(adminId).select("fullName email").lean();
    adminName = admin?.fullName || admin?.email || "";
  }
  return { adminId, adminName };
};

export const listDefectiveInventory = asyncHandler(async (req, res) => {
  const result = await defectiveInventoryService.list(req.query);
  sendSuccess(res, 200, result, "Defective inventory retrieved");
});

export const updateDefectiveInventoryStatus = asyncHandler(async (req, res) => {
  const result = await defectiveInventoryService.updateStatus(
    req.params.id,
    await buildAdminContext(req),
    req.body,
  );
  sendSuccess(res, 200, result, "Defective inventory updated");
});
