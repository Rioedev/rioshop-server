import mongoose from "mongoose";
import PurchaseOrder from "../models/PurchaseOrder.js";
import Product from "../models/Product.js";
import Supplier from "../models/Supplier.js";
import InventoryAdjustment from "../models/InventoryAdjustment.js";
import inventoryService from "./inventoryService.js";
import { AppError } from "../utils/helpers.js";

// State machine:
//   draft → ordered → partially_received → received
//                                       ↘ cancelled (if not fully received)
//   draft → cancelled
//
// Quy tắc:
//   - Sửa lines chỉ được khi status === draft
//   - confirmOrder: draft → ordered, tăng variant.incoming theo orderedQty
//   - cancelOrder: chỉ draft hoặc ordered/partially_received. Hoàn lại variant.incoming
//     phần CHƯA nhận (orderedQty - receivedQty)
//   - receiveLines: ordered/partially_received → partially_received hoặc received
//     mỗi line: variant.stock += qty, variant.incoming -= qty,
//     costPrice tính lại weighted avg, tạo InventoryAdjustment
// cancelled chỉ áp khi CHƯA nhận hàng (từ draft/ordered).
// closed áp khi đã nhận một phần nhưng admin quyết định dừng (kế toán cần ghi).
const ALLOWED_TRANSITIONS = {
  draft: new Set(["ordered", "cancelled"]),
  ordered: new Set(["partially_received", "received", "cancelled"]),
  partially_received: new Set(["partially_received", "received", "closed"]),
  received: new Set(),
  cancelled: new Set(),
  closed: new Set(),
};

const MONTH_PREFIX = (date = new Date()) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${yyyy}${mm}`;
};

const MAX_PO_NUMBER_RETRIES = 3;

const applySession = (query, session) => (session ? query.session(session) : query);
const saveOptions = (session) => (session ? { session } : undefined);

class PurchaseOrderService {
  async runAtomic(work) {
    const session = await mongoose.startSession();
    let shouldEndSession = true;

    try {
      let result;
      try {
        await session.withTransaction(async () => {
          result = await work(session);
        });
        return result;
      } catch (error) {
        if (!this.isTransactionUnsupported(error)) {
          throw error;
        }

        await session.endSession();
        shouldEndSession = false;
        return work(null);
      }
    } finally {
      if (shouldEndSession) {
        await session.endSession();
      }
    }
  }

  isTransactionUnsupported(error) {
    const message = String(error?.message || "");
    return (
      message.includes("Transaction numbers are only allowed") ||
      message.includes("does not support transactions")
    );
  }

  isDuplicatePoNumber(error) {
    return (
      error?.code === 11000 &&
      (error?.keyPattern?.poNumber || error?.keyValue?.poNumber)
    );
  }

  async generatePoNumber(session = null) {
    const now = new Date();
    const prefix = `PO-${MONTH_PREFIX(now)}-`;
    // Lấy PO mới nhất trong tháng để tìm sequence kế tiếp.
    const last = await applySession(
      PurchaseOrder.findOne({ poNumber: new RegExp(`^${prefix}`) })
        .sort({ poNumber: -1 })
        .select("poNumber")
        .lean(),
      session,
    );
    let next = 1;
    if (last?.poNumber) {
      const tail = last.poNumber.slice(prefix.length);
      const parsed = Number.parseInt(tail, 10);
      if (Number.isFinite(parsed)) next = parsed + 1;
    }
    return `${prefix}${String(next).padStart(4, "0")}`;
  }

  buildLineSnapshot(product, variant, line) {
    return {
      productId: product._id,
      productNameSnapshot: product.name || "",
      variantSku: variant.sku,
      variantLabelSnapshot: this.buildVariantLabel(variant),
      orderedQty: Number(line.orderedQty),
      receivedQty: 0,
      unitCost: Number(line.unitCost),
      lineTotal: Math.round(Number(line.orderedQty) * Number(line.unitCost)),
    };
  }

  buildVariantLabel(variant = {}) {
    const color = variant?.color?.name?.toString().trim();
    const size = variant?.sizeLabel?.toString().trim() || variant?.size?.toString().trim();
    if (color && size) return `${color} / ${size}`;
    return color || size || variant?.sku || "";
  }

  async resolveLinesAndProducts(rawLines = [], { session = null } = {}) {
    const sourceLines = Array.isArray(rawLines) ? rawLines : [];
    const productIds = [...new Set(sourceLines.map((line) => line?.productId).filter(Boolean))];
    if (productIds.length === 0) {
      throw new AppError("PO cần ít nhất 1 dòng sản phẩm", 400);
    }
    const products = await applySession(
      Product.find({ _id: { $in: productIds }, deletedAt: null }),
      session,
    );
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    const resolved = [];
    const seenVariantSkus = new Set();
    for (const line of sourceLines) {
      const product = productMap.get(line.productId?.toString());
      if (!product) throw new AppError(`Sản phẩm ${line.productId} không tồn tại`, 404);

      const variantSku = (line.variantSku || "").toString().trim();
      if (!variantSku) {
        throw new AppError("Mỗi dòng PO cần variantSku", 400);
      }
      if (seenVariantSkus.has(variantSku)) {
        throw new AppError(`Variant ${variantSku} bị lặp trong PO`, 400);
      }
      seenVariantSkus.add(variantSku);

      const variant = (product.variants || []).find(
        (v) => (v.sku || "").trim() === variantSku,
      );
      if (!variant) {
        throw new AppError(`Variant ${variantSku} không thuộc sản phẩm`, 400);
      }

      const orderedQty = Math.floor(Number(line.orderedQty || 0));
      const unitCost = Number(line.unitCost ?? 0);
      if (!Number.isFinite(orderedQty) || orderedQty <= 0) {
        throw new AppError(`Dòng ${variant.sku}: số lượng phải > 0`, 400);
      }
      if (!Number.isFinite(unitCost) || unitCost < 0) {
        throw new AppError(`Dòng ${variant.sku}: giá vốn không hợp lệ`, 400);
      }

      resolved.push({
        product,
        variant,
        snapshot: this.buildLineSnapshot(product, variant, {
          orderedQty,
          unitCost,
        }),
      });
    }
    return resolved;
  }

  computeTotals(lines) {
    const subtotal = lines.reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
    return { subtotal, tax: 0, total: subtotal };
  }

  async list({ page = 1, limit = 20, status, supplierId, search, from, to } = {}) {
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

    return PurchaseOrder.paginate(query, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      sort: { createdAt: -1 },
      populate: [{ path: "supplierId", select: "_id name type" }],
    });
  }

  async getById(id, { session = null } = {}) {
    const po = await applySession(
      PurchaseOrder.findById(id).populate({
        path: "supplierId",
        select: "_id name type phone email",
      }),
      session,
    );
    if (!po) throw new AppError("Đơn nhập không tồn tại", 404);
    return po;
  }

  async createDraft(adminContext, payload = {}) {
    for (let attempt = 1; attempt <= MAX_PO_NUMBER_RETRIES; attempt += 1) {
      try {
        return await this.runAtomic(async (session) => {
          const supplier = await applySession(
            Supplier.findOne({ _id: payload.supplierId, deletedAt: null }),
            session,
          );
          if (!supplier) throw new AppError("Nhà cung cấp không tồn tại", 404);

          const resolved = await this.resolveLinesAndProducts(payload.lines || [], { session });
          const lines = resolved.map((item) => item.snapshot);
          const totals = this.computeTotals(lines);

          const poNumber = await this.generatePoNumber(session);
          const po = new PurchaseOrder({
            poNumber,
            supplierId: supplier._id,
            supplierNameSnapshot: supplier.name,
            supplierType: supplier.type,
            status: "draft",
            expectedDeliveryDate: payload.expectedDeliveryDate || null,
            lines,
            ...totals,
            note: (payload.note || "").toString().trim(),
            createdBy: adminContext.adminId || null,
            createdByName: adminContext.adminName || "",
            timeline: [
              {
                status: "draft",
                note: "Tạo nháp",
                byName: adminContext.adminName || "",
              },
            ],
          });
          await po.save(saveOptions(session));
          return po;
        });
      } catch (error) {
        if (attempt < MAX_PO_NUMBER_RETRIES && this.isDuplicatePoNumber(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new AppError("Không tạo được mã đơn nhập duy nhất", 500);
  }

  async updateDraft(id, payload = {}) {
    return this.runAtomic(async (session) => {
      const po = await this.getById(id, { session });
      if (po.status !== "draft") {
        throw new AppError("Chỉ sửa được khi đơn nhập đang ở trạng thái Nháp", 400);
      }

      if (payload.supplierId && payload.supplierId.toString() !== po.supplierId.toString()) {
        const supplier = await applySession(
          Supplier.findOne({ _id: payload.supplierId, deletedAt: null }),
          session,
        );
        if (!supplier) throw new AppError("Nhà cung cấp không tồn tại", 404);
        po.supplierId = supplier._id;
        po.supplierNameSnapshot = supplier.name;
        po.supplierType = supplier.type;
      }

      if (payload.expectedDeliveryDate !== undefined) {
        po.expectedDeliveryDate = payload.expectedDeliveryDate || null;
      }
      if (payload.note !== undefined) {
        po.note = (payload.note || "").toString().trim();
      }

      if (Array.isArray(payload.lines)) {
        const resolved = await this.resolveLinesAndProducts(payload.lines, { session });
        po.lines = resolved.map((item) => item.snapshot);
        const totals = this.computeTotals(po.lines);
        po.subtotal = totals.subtotal;
        po.total = totals.total;
      }

      po.updatedAt = new Date();
      await po.save(saveOptions(session));
      return po;
    });
  }

  ensureTransition(currentStatus, nextStatus) {
    if (!ALLOWED_TRANSITIONS[currentStatus]?.has(nextStatus)) {
      throw new AppError(
        `Không thể chuyển trạng thái ${currentStatus} → ${nextStatus}`,
        400,
      );
    }
  }

  async confirmOrder(id, adminContext) {
    return this.runAtomic(async (session) => {
      const po = await this.getById(id, { session });
      this.ensureTransition(po.status, "ordered");

      // Tăng variant.incoming theo orderedQty cho mỗi line
      const productIds = [...new Set(po.lines.map((line) => line.productId.toString()))];
      const products = await applySession(
        Product.find({ _id: { $in: productIds }, deletedAt: null }),
        session,
      );
      const productMap = new Map(products.map((p) => [p._id.toString(), p]));

      for (const line of po.lines) {
        const product = productMap.get(line.productId.toString());
        if (!product) {
          throw new AppError(`Sản phẩm ${line.productNameSnapshot} không tồn tại`, 404);
        }
        const variant = (product.variants || []).find(
          (v) => (v.sku || "").trim() === line.variantSku,
        );
        if (!variant) {
          throw new AppError(`Variant ${line.variantSku} không tồn tại`, 400);
        }
        variant.incoming = Math.max(0, Number(variant.incoming || 0)) + Number(line.orderedQty);
      }
      for (const product of productMap.values()) {
        product.markModified("variants");
        product.updatedAt = new Date();
        await product.save(saveOptions(session));
        await inventoryService.syncInventoryRecordsFromProduct(product, { session });
      }

      po.status = "ordered";
      po.orderedAt = new Date();
      po.timeline.push({
        status: "ordered",
        note: "Đã gửi đặt hàng",
        byName: adminContext.adminName || "",
      });
      await po.save(saveOptions(session));
      return po;
    });
  }

  async cancelOrder(id, adminContext, reason = "") {
    return this.runAtomic(async (session) => {
      const po = await this.getById(id, { session });
      // Đã nhận một phần → chuyển sang "closed" thay vì "cancelled" để kế toán phân biệt:
      //   cancelled = hủy hoàn toàn, không có hàng vào kho
      //   closed    = đóng đơn sớm, một phần hàng đã vào kho
      const isPartiallyReceived = po.status === "partially_received";
      const targetStatus = isPartiallyReceived ? "closed" : "cancelled";
      this.ensureTransition(po.status, targetStatus);

      // Nếu PO đã ordered hoặc partially_received → hoàn lại variant.incoming cho phần CHƯA nhận
      if (po.status === "ordered" || po.status === "partially_received") {
        const productIds = [...new Set(po.lines.map((line) => line.productId.toString()))];
        const products = await applySession(
          Product.find({ _id: { $in: productIds }, deletedAt: null }),
          session,
        );
        const productMap = new Map(products.map((p) => [p._id.toString(), p]));

        for (const line of po.lines) {
          const product = productMap.get(line.productId.toString());
          if (!product) continue;
          const variant = (product.variants || []).find(
            (v) => (v.sku || "").trim() === line.variantSku,
          );
          if (!variant) continue;
          const pendingQty = Math.max(0, Number(line.orderedQty) - Number(line.receivedQty));
          variant.incoming = Math.max(0, Number(variant.incoming || 0) - pendingQty);
        }
        for (const product of productMap.values()) {
          product.markModified("variants");
          product.updatedAt = new Date();
          await product.save(saveOptions(session));
          await inventoryService.syncInventoryRecordsFromProduct(product, { session });
        }
      }

      po.status = targetStatus;
      po.cancelledAt = new Date();
      po.cancelReason = (reason || "").toString().trim();
      po.timeline.push({
        status: targetStatus,
        note: reason || (isPartiallyReceived ? "Đóng đơn sớm (đã nhận một phần)" : "Hủy đơn nhập"),
        byName: adminContext.adminName || "",
      });
      await po.save(saveOptions(session));
      return po;
    });
  }

  // Nhận hàng — payload.lines = [{ variantSku, qty, unitCost? }]
  // unitCost mặc định lấy từ PO line; có thể override nếu giá thực tế khác.
  async receiveLines(id, adminContext, payload = {}) {
    return this.runAtomic(async (session) => {
      const po = await this.getById(id, { session });
      if (po.status !== "ordered" && po.status !== "partially_received") {
        throw new AppError(
          "Chỉ nhận hàng được khi PO ở trạng thái đã đặt hoặc nhận một phần",
          400,
        );
      }

      const inputLines = Array.isArray(payload.lines) ? payload.lines : [];
      const validInputs = [];
      const seenInputSkus = new Set();

      for (const line of inputLines) {
        const variantSku = (line?.variantSku || "").toString().trim();
        if (!variantSku) continue;

        const qtyRaw = Number(line?.qty ?? 0);
        if (!Number.isFinite(qtyRaw)) {
          throw new AppError(`Variant ${variantSku}: số lượng nhận không hợp lệ`, 400);
        }

        const qty = Math.floor(qtyRaw);
        if (qty <= 0) continue;

        if (seenInputSkus.has(variantSku)) {
          throw new AppError(`Variant ${variantSku} bị lặp trong phiếu nhận`, 400);
        }
        seenInputSkus.add(variantSku);

        let unitCost = null;
        if (line?.unitCost !== undefined) {
          unitCost = Number(line.unitCost);
          if (!Number.isFinite(unitCost) || unitCost < 0) {
            throw new AppError(`Variant ${variantSku}: giá vốn không hợp lệ`, 400);
          }
        }

        validInputs.push({ variantSku, qty, unitCost });
      }

      if (validInputs.length === 0) {
        throw new AppError("Cần ít nhất 1 dòng có số lượng > 0", 400);
      }

      // Map nhanh các line trong PO theo SKU để check
      const poLineMap = new Map(po.lines.map((line) => [line.variantSku, line]));
      if (poLineMap.size !== po.lines.length) {
        throw new AppError("PO có variant SKU bị lặp, không thể nhận hàng an toàn", 400);
      }

      // Validate qty không vượt qua phần còn thiếu
      for (const input of validInputs) {
        const poLine = poLineMap.get(input.variantSku);
        if (!poLine) {
          throw new AppError(`Variant ${input.variantSku} không thuộc PO này`, 400);
        }
        const remaining = Number(poLine.orderedQty) - Number(poLine.receivedQty);
        if (input.qty > remaining) {
          throw new AppError(
            `Variant ${input.variantSku}: nhận ${input.qty} vượt quá phần còn lại ${remaining}`,
            400,
          );
        }
      }

      // Load các product để update stock + cost
      const productIds = [...new Set(po.lines.map((line) => line.productId.toString()))];
      const products = await applySession(
        Product.find({ _id: { $in: productIds }, deletedAt: null }),
        session,
      );
      const productMap = new Map(products.map((p) => [p._id.toString(), p]));

      // Snapshot tổng tồn + giá vốn HIỆN TẠI từng product (trước khi áp phiếu nhận này)
      // — dùng để tính weighted avg ở cấp product theo công thức:
      //   newCost = (oldTotalStock × oldCost + Σ qty_i × cost_i) / (oldTotalStock + Σ qty_i)
      const productCostBefore = new Map();
      for (const product of productMap.values()) {
        const totalStock = (product.variants || []).reduce(
          (sum, v) => sum + Math.max(0, Number(v.stock || 0)),
          0,
        );
        const cost = Math.max(0, Number(product.pricing?.costPrice || 0));
        productCostBefore.set(product._id.toString(), {
          totalStock,
          cost,
          addedValue: 0,
          addedQty: 0,
        });
      }

      const adjustments = [];
      const receiptLines = [];

      for (const input of validInputs) {
        const poLine = poLineMap.get(input.variantSku);
        const product = productMap.get(poLine.productId.toString());
        if (!product) {
          throw new AppError(`Sản phẩm ${poLine.productNameSnapshot} không tồn tại`, 404);
        }
        const variant = (product.variants || []).find(
          (v) => (v.sku || "").trim() === input.variantSku,
        );
        if (!variant) {
          throw new AppError(`Variant ${input.variantSku} không tồn tại`, 400);
        }

        const unitCost = input.unitCost ?? Number(poLine.unitCost);
        if (!Number.isFinite(unitCost) || unitCost < 0) {
          throw new AppError(`Variant ${input.variantSku}: giá vốn không hợp lệ`, 400);
        }
        const stockBefore = Math.max(0, Number(variant.stock || 0));
        const stockAfter = stockBefore + input.qty;

        variant.stock = stockAfter;
        variant.incoming = Math.max(0, Number(variant.incoming || 0) - input.qty);
        poLine.receivedQty = Number(poLine.receivedQty) + input.qty;

        // Gom dồn giá trị nhập về product để tính weighted avg sau khi xong vòng
        const agg = productCostBefore.get(product._id.toString());
        agg.addedValue += input.qty * unitCost;
        agg.addedQty += input.qty;

        adjustments.push({
          batchId: po.poNumber,
          productId: product._id,
          productNameSnapshot: product.name || "",
          variantSku: input.variantSku,
          variantLabelSnapshot: this.buildVariantLabel(variant),
          qtyDelta: input.qty,
          unitCost,
          stockBefore,
          stockAfter,
          costBefore: agg.cost,
          costAfter: 0, // sẽ ghi đè bên dưới sau khi tính weighted avg
          reason: "purchase_receipt",
          purchaseOrderId: po._id,
          supplierId: po.supplierId,
          supplierName: po.supplierNameSnapshot,
          note: (payload.note || "").toString().trim(),
          createdBy: adminContext.adminId || null,
          createdByName: adminContext.adminName || "",
        });

        receiptLines.push({
          variantSku: input.variantSku,
          qty: input.qty,
          unitCost,
        });
      }

      // Tính weighted avg costPrice mới cho từng product + gán vào adjustments
      for (const product of productMap.values()) {
        const agg = productCostBefore.get(product._id.toString());
        const newTotalStock = agg.totalStock + agg.addedQty;
        const newCost =
          newTotalStock > 0
            ? (agg.totalStock * agg.cost + agg.addedValue) / newTotalStock
            : agg.cost;
        // Lưu costPrice dạng float (không round) để tránh accumulation error
        // qua nhiều lần nhập nhỏ. Frontend round khi hiển thị.
        product.pricing = {
          ...(product.pricing?.toObject?.() ?? product.pricing ?? {}),
          costPrice: newCost,
        };
        product.markModified("pricing");
        product.markModified("variants");
        product.updatedAt = new Date();
        await product.save(saveOptions(session));
        await inventoryService.syncInventoryRecordsFromProduct(product, { session });
      }

      // Ghi costAfter vào từng adjustment
      for (const adj of adjustments) {
        const product = productMap.get(adj.productId.toString());
        adj.costAfter = Number(product?.pricing?.costPrice ?? 0);
      }

      // Insert adjustments để audit
      await InventoryAdjustment.insertMany(adjustments, saveOptions(session));

      // Update PO: receipts log + lines.receivedQty (đã update inline) + status
      po.receipts.push({
        receivedAt: new Date(),
        receivedBy: adminContext.adminId || null,
        receivedByName: adminContext.adminName || "",
        lines: receiptLines,
        note: (payload.note || "").toString().trim(),
      });

      const isFullyReceived = po.lines.every(
        (line) => Number(line.receivedQty) >= Number(line.orderedQty),
      );
      po.status = isFullyReceived ? "received" : "partially_received";
      if (isFullyReceived) po.receivedAt = new Date();

      po.timeline.push({
        status: po.status,
        note: isFullyReceived ? "Đã nhận đủ hàng" : "Đã nhận một phần",
        byName: adminContext.adminName || "",
      });

      po.markModified("lines");
      po.updatedAt = new Date();
      await po.save(saveOptions(session));

      return po;
    });
  }
}

export default new PurchaseOrderService();
