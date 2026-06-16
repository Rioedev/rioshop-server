import ExcelJS from "exceljs";
import PurchaseOrder from "../models/PurchaseOrder.js";
import { asyncHandler, sendSuccess } from "../utils/helpers.js";
import purchaseOrderService from "../services/purchaseOrderService.js";
import Admin from "../models/Admin.js";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_EXPORT_PO_ROWS = 10000;

const PO_STATUS_LABELS = {
  draft: "Nháp",
  ordered: "Đã đặt",
  partially_received: "Nhận một phần",
  received: "Đã nhận đủ",
  cancelled: "Đã hủy",
  closed: "Đã đóng",
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date;
};

const toNumber = (value) => Number(value || 0);

const buildPurchaseOrderQuery = ({ status, supplierId, search, from, to } = {}) => {
  const query = {};
  if (status) query.status = status;
  if (supplierId) query.supplierId = supplierId;
  if (search) {
    const trimmed = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { poNumber: { $regex: trimmed, $options: "i" } },
      { supplierNameSnapshot: { $regex: trimmed, $options: "i" } },
    ];
  }
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);
  }
  return query;
};

const styleWorksheet = (worksheet) => {
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E78" },
  };
  worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFD9E2F3" } },
        left: { style: "thin", color: { argb: "FFD9E2F3" } },
        bottom: { style: "thin", color: { argb: "FFD9E2F3" } },
        right: { style: "thin", color: { argb: "FFD9E2F3" } },
      };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
  });
};

const sendWorkbook = async (res, workbook, fileName) => {
  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader("Content-Type", XLSX_CONTENT_TYPE);
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.status(200).send(Buffer.from(buffer));
};

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

export const exportPurchaseOrdersXlsx = asyncHandler(async (req, res) => {
  const { status, supplierId, search, from, to } = req.query;
  const query = buildPurchaseOrderQuery({ status, supplierId, search, from, to });
  const purchaseOrders = await PurchaseOrder.find(query)
    .populate({ path: "supplierId", select: "_id name type" })
    .sort({ createdAt: -1 })
    .limit(MAX_EXPORT_PO_ROWS)
    .lean();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RioShop";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Danh sach PO");
  worksheet.columns = [
    { header: "Mã PO", key: "poNumber", width: 18 },
    { header: "Nhà cung cấp", key: "supplierName", width: 28 },
    { header: "Loại NCC", key: "supplierType", width: 14 },
    { header: "Trạng thái", key: "status", width: 18 },
    { header: "Ngày tạo", key: "createdAt", width: 18 },
    { header: "Ngày dự kiến nhận", key: "expectedDeliveryDate", width: 18 },
    { header: "Ngày đặt", key: "orderedAt", width: 18 },
    { header: "Ngày nhận đủ", key: "receivedAt", width: 18 },
    { header: "Số dòng", key: "lineCount", width: 10 },
    { header: "SL đặt", key: "orderedQty", width: 12 },
    { header: "SL đã nhận", key: "receivedQty", width: 12 },
    { header: "SL còn lại", key: "remainingQty", width: 12 },
    { header: "Tạm tính", key: "subtotal", width: 16 },
    { header: "Thuế", key: "tax", width: 14 },
    { header: "Tổng tiền", key: "total", width: 16 },
    { header: "Người tạo", key: "createdByName", width: 20 },
    { header: "Ghi chú", key: "note", width: 36 },
  ];

  purchaseOrders.forEach((po) => {
    const orderedQty = (po.lines || []).reduce((sum, line) => sum + toNumber(line.orderedQty), 0);
    const receivedQty = (po.lines || []).reduce((sum, line) => sum + toNumber(line.receivedQty), 0);
    worksheet.addRow({
      poNumber: po.poNumber,
      supplierName: po.supplierNameSnapshot || po.supplierId?.name || "",
      supplierType: po.supplierType === "internal" ? "Nội bộ" : "Mua ngoài",
      status: PO_STATUS_LABELS[po.status] || po.status,
      createdAt: formatDate(po.createdAt),
      expectedDeliveryDate: formatDate(po.expectedDeliveryDate),
      orderedAt: formatDate(po.orderedAt),
      receivedAt: formatDate(po.receivedAt),
      lineCount: (po.lines || []).length,
      orderedQty,
      receivedQty,
      remainingQty: Math.max(0, orderedQty - receivedQty),
      subtotal: toNumber(po.subtotal),
      tax: toNumber(po.tax),
      total: toNumber(po.total),
      createdByName: po.createdByName || "",
      note: po.note || "",
    });
  });

  ["createdAt", "expectedDeliveryDate", "orderedAt", "receivedAt"].forEach((key) => {
    worksheet.getColumn(key).numFmt = "dd/mm/yyyy hh:mm";
  });
  ["subtotal", "tax", "total"].forEach((key) => {
    worksheet.getColumn(key).numFmt = '#,##0" ₫"';
  });
  styleWorksheet(worksheet);

  const suffix = new Date().toISOString().slice(0, 10);
  await sendWorkbook(res, workbook, `purchase-orders-${suffix}.xlsx`);
});

export const exportPurchaseOrderDetailXlsx = asyncHandler(async (req, res) => {
  const po = await purchaseOrderService.getById(req.params.id);
  const plainPo = po?.toObject ? po.toObject() : po;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RioShop";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Tong quan");
  summary.columns = [
    { header: "Thông tin", key: "label", width: 24 },
    { header: "Giá trị", key: "value", width: 48 },
  ];
  summary.addRows([
    { label: "Mã PO", value: plainPo.poNumber },
    { label: "Nhà cung cấp", value: plainPo.supplierNameSnapshot },
    { label: "Loại NCC", value: plainPo.supplierType === "internal" ? "Nội bộ" : "Mua ngoài" },
    { label: "Trạng thái", value: PO_STATUS_LABELS[plainPo.status] || plainPo.status },
    { label: "Ngày tạo", value: formatDate(plainPo.createdAt) },
    { label: "Ngày dự kiến nhận", value: formatDate(plainPo.expectedDeliveryDate) },
    { label: "Ngày đặt", value: formatDate(plainPo.orderedAt) },
    { label: "Ngày nhận đủ", value: formatDate(plainPo.receivedAt) },
    { label: "Người tạo", value: plainPo.createdByName || "" },
    { label: "Tạm tính", value: toNumber(plainPo.subtotal) },
    { label: "Thuế", value: toNumber(plainPo.tax) },
    { label: "Tổng tiền", value: toNumber(plainPo.total) },
    { label: "Ghi chú", value: plainPo.note || "" },
  ]);
  summary.getColumn("value").numFmt = '#,##0" ₫"';
  summary.getColumn("value").eachCell((cell, rowNumber) => {
    if (rowNumber >= 5 && rowNumber <= 8) {
      cell.numFmt = "dd/mm/yyyy hh:mm";
    }
    if (rowNumber < 10 || rowNumber > 12) {
      cell.numFmt = "@";
    }
  });
  styleWorksheet(summary);

  const lines = workbook.addWorksheet("Dong hang");
  lines.columns = [
    { header: "Mã PO", key: "poNumber", width: 18 },
    { header: "Sản phẩm", key: "productName", width: 32 },
    { header: "Variant SKU", key: "variantSku", width: 24 },
    { header: "Màu / Size", key: "variantLabel", width: 24 },
    { header: "SL đặt", key: "orderedQty", width: 12 },
    { header: "SL đã nhận", key: "receivedQty", width: 12 },
    { header: "SL còn lại", key: "remainingQty", width: 12 },
    { header: "Giá nhập", key: "unitCost", width: 16 },
    { header: "Thành tiền đặt", key: "lineTotal", width: 16 },
    { header: "Giá trị đã nhận", key: "receivedTotal", width: 16 },
  ];
  (plainPo.lines || []).forEach((line) => {
    const orderedQty = toNumber(line.orderedQty);
    const receivedQty = toNumber(line.receivedQty);
    const unitCost = toNumber(line.unitCost);
    lines.addRow({
      poNumber: plainPo.poNumber,
      productName: line.productNameSnapshot || "",
      variantSku: line.variantSku || "",
      variantLabel: line.variantLabelSnapshot || "",
      orderedQty,
      receivedQty,
      remainingQty: Math.max(0, orderedQty - receivedQty),
      unitCost,
      lineTotal: toNumber(line.lineTotal),
      receivedTotal: receivedQty * unitCost,
    });
  });
  ["unitCost", "lineTotal", "receivedTotal"].forEach((key) => {
    lines.getColumn(key).numFmt = '#,##0" ₫"';
  });
  styleWorksheet(lines);

  const receipts = workbook.addWorksheet("Lich su nhan");
  receipts.columns = [
    { header: "Lần nhận", key: "receiptIndex", width: 10 },
    { header: "Ngày nhận", key: "receivedAt", width: 18 },
    { header: "Người nhận", key: "receivedByName", width: 20 },
    { header: "Variant SKU", key: "variantSku", width: 24 },
    { header: "SL nhận", key: "qty", width: 12 },
    { header: "Giá nhập", key: "unitCost", width: 16 },
    { header: "Thành tiền", key: "lineTotal", width: 16 },
    { header: "Ghi chú", key: "note", width: 32 },
  ];
  (plainPo.receipts || []).forEach((receipt, receiptIndex) => {
    (receipt.lines || []).forEach((line) => {
      receipts.addRow({
        receiptIndex: receiptIndex + 1,
        receivedAt: formatDate(receipt.receivedAt),
        receivedByName: receipt.receivedByName || "",
        variantSku: line.variantSku || "",
        qty: toNumber(line.qty),
        unitCost: toNumber(line.unitCost),
        lineTotal: toNumber(line.qty) * toNumber(line.unitCost),
        note: receipt.note || "",
      });
    });
  });
  receipts.getColumn("receivedAt").numFmt = "dd/mm/yyyy hh:mm";
  ["unitCost", "lineTotal"].forEach((key) => {
    receipts.getColumn(key).numFmt = '#,##0" ₫"';
  });
  styleWorksheet(receipts);

  const timeline = workbook.addWorksheet("Timeline");
  timeline.columns = [
    { header: "Thời gian", key: "at", width: 18 },
    { header: "Trạng thái", key: "status", width: 20 },
    { header: "Người thao tác", key: "byName", width: 20 },
    { header: "Ghi chú", key: "note", width: 48 },
  ];
  (plainPo.timeline || []).forEach((entry) => {
    timeline.addRow({
      at: formatDate(entry.at),
      status: PO_STATUS_LABELS[entry.status] || entry.status,
      byName: entry.byName || "",
      note: entry.note || "",
    });
  });
  timeline.getColumn("at").numFmt = "dd/mm/yyyy hh:mm";
  styleWorksheet(timeline);

  await sendWorkbook(res, workbook, `purchase-order-${plainPo.poNumber || plainPo._id}.xlsx`);
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
