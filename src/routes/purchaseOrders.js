import express from "express";
import { authenticateToken, authorizeRole } from "../middlewares/auth.js";
import {
  listPurchaseOrders,
  getPurchaseOrder,
  exportPurchaseOrdersXlsx,
  exportPurchaseOrderDetailXlsx,
  createPurchaseOrder,
  updatePurchaseOrder,
  confirmPurchaseOrder,
  cancelPurchaseOrder,
  receivePurchaseOrder,
} from "../controllers/purchaseOrderController.js";

const router = express.Router();

// Toàn bộ PO dành cho admin
router.use(authenticateToken);
router.use(authorizeRole("superadmin", "manager", "warehouse"));

router.get("/", listPurchaseOrders);
router.get("/export-xlsx", exportPurchaseOrdersXlsx);
router.get("/:id/export-xlsx", exportPurchaseOrderDetailXlsx);
router.get("/:id", getPurchaseOrder);
router.post("/", createPurchaseOrder);
router.put("/:id", updatePurchaseOrder);
router.post("/:id/confirm", confirmPurchaseOrder);
router.post("/:id/cancel", cancelPurchaseOrder);
router.post("/:id/receive", receivePurchaseOrder);

export default router;
