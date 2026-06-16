import { asyncHandler, sendSuccess } from "../utils/helpers.js";
import purchaseOrderService from "../services/purchaseOrderService.js";
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

export const listPurchaseOrders = asyncHandler(async (req, res) => {
  const { page, limit, status, supplierId, search, from, to } = req.query;
  const result = await purchaseOrderService.list({ page, limit, status, supplierId, search, from, to });
  sendSuccess(res, 200, result, "OK");
});

export const getPurchaseOrder = asyncHandler(async (req, res) => {
  const po = await purchaseOrderService.getById(req.params.id);
  sendSuccess(res, 200, po, "OK");
});

export const createPurchaseOrder = asyncHandler(async (req, res) => {
  const po = await purchaseOrderService.createDraft(await buildAdminContext(req), req.body);
  sendSuccess(res, 201, po, "Đã tạo đơn nhập nháp");
});

export const updatePurchaseOrder = asyncHandler(async (req, res) => {
  const po = await purchaseOrderService.updateDraft(req.params.id, req.body);
  sendSuccess(res, 200, po, "Updated");
});

export const confirmPurchaseOrder = asyncHandler(async (req, res) => {
  const po = await purchaseOrderService.confirmOrder(req.params.id, await buildAdminContext(req));
  sendSuccess(res, 200, po, "Đã đặt hàng");
});

export const cancelPurchaseOrder = asyncHandler(async (req, res) => {
  const po = await purchaseOrderService.cancelOrder(
    req.params.id,
    await buildAdminContext(req),
    req.body?.reason || "",
  );
  sendSuccess(res, 200, po, "Đã hủy");
});

export const receivePurchaseOrder = asyncHandler(async (req, res) => {
  const po = await purchaseOrderService.receiveLines(
    req.params.id,
    await buildAdminContext(req),
    req.body,
  );
  sendSuccess(res, 200, po, "Đã ghi nhận nhập hàng");
});
