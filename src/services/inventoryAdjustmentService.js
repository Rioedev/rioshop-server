import crypto from "crypto";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import InventoryAdjustment from "../models/InventoryAdjustment.js";
import inventoryService from "./inventoryService.js";
import { AppError } from "../utils/helpers.js";

// Điều chỉnh tồn kho ngoài luồng PO — dùng cho:
//   - stocktake_diff: kiểm kê thấy lệch (có thể + hoặc -)
//   - damaged: hàng hư hỏng (luôn -)
//   - lost: mất hàng (luôn -)
//   - other: khác (cần note rõ)
//
// KHÔNG đụng tới costPrice (giá vốn không thay đổi khi giảm/tăng do mất/hỏng).
const ALLOWED_REASONS = new Set(["stocktake_diff", "damaged", "lost", "other"]);

const applySession = (query, session) => (session ? query.session(session) : query);
const saveOptions = (session) => (session ? { session } : undefined);

class InventoryAdjustmentService {
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

  async adjust(adminContext, payload = {}) {
    return this.runAtomic(async (session) => {
      const { productId, reason, note = "", lines = [] } = payload;
      if (!productId) throw new AppError("productId is required", 400);
      if (!ALLOWED_REASONS.has(reason)) {
        throw new AppError("Lý do điều chỉnh không hợp lệ", 400);
      }
      if (!Array.isArray(lines) || lines.length === 0) {
        throw new AppError("Cần ít nhất 1 dòng điều chỉnh", 400);
      }

      const product = await applySession(
        Product.findOne({ _id: productId, deletedAt: null }),
        session,
      );
      if (!product) throw new AppError("Product not found", 404);

      const validLines = [];
      const seenSkus = new Set();
      for (const line of lines) {
        const variantSku = (line?.variantSku || "").toString().trim();
        if (!variantSku) continue;

        const qtyRaw = Number(line?.qtyDelta ?? 0);
        if (!Number.isFinite(qtyRaw)) {
          throw new AppError(`Variant ${variantSku}: số lượng điều chỉnh không hợp lệ`, 400);
        }

        const qtyDelta = Math.floor(qtyRaw);
        if (qtyDelta === 0) continue;

        if (seenSkus.has(variantSku)) {
          throw new AppError(`Variant ${variantSku} bị lặp trong phiếu điều chỉnh`, 400);
        }
        seenSkus.add(variantSku);

        validLines.push({ variantSku, qtyDelta });
      }

      if (validLines.length === 0) {
        throw new AppError("Tất cả dòng đều có qty = 0", 400);
      }

      // damaged/lost luôn phải âm
      if ((reason === "damaged" || reason === "lost") && validLines.some((line) => line.qtyDelta > 0)) {
        throw new AppError(
          "Lý do hư hỏng/mất hàng chỉ chấp nhận giảm số lượng (qty âm)",
          400,
        );
      }

      const variantMap = new Map(
        (product.variants || []).map((v) => [(v.sku || "").trim(), v]),
      );

      const batchId = crypto.randomBytes(8).toString("hex");
      const adjustments = [];

      const productCost = Math.max(0, Number(product.pricing?.costPrice || 0));

      for (const line of validLines) {
        const variant = variantMap.get(line.variantSku);
        if (!variant) {
          throw new AppError(`Variant ${line.variantSku} không thuộc sản phẩm này`, 400);
        }
        const stockBefore = Math.max(0, Number(variant.stock || 0));
        const stockAfter = stockBefore + line.qtyDelta;

        if (stockAfter < 0) {
          throw new AppError(
            `Variant ${line.variantSku}: tồn hiện tại ${stockBefore}, không thể giảm ${Math.abs(line.qtyDelta)}`,
            400,
          );
        }

        variant.stock = stockAfter;
        // Giá vốn KHÔNG đổi khi điều chỉnh (hư/mất/kiểm kê) — vẫn dùng cost product hiện tại

        adjustments.push({
          batchId,
          productId: product._id,
          productNameSnapshot: product.name || "",
          variantSku: line.variantSku,
          variantLabelSnapshot: this.buildVariantLabel(variant),
          qtyDelta: line.qtyDelta,
          unitCost: 0,
          stockBefore,
          stockAfter,
          costBefore: productCost,
          costAfter: productCost,
          reason,
          purchaseOrderId: null,
          supplierId: null,
          supplierName: "",
          note: (note || "").toString().trim(),
          createdBy: adminContext.adminId || null,
          createdByName: adminContext.adminName || "",
        });
      }

      product.markModified("variants");
      product.updatedAt = new Date();
      await product.save(saveOptions(session));
      await inventoryService.syncInventoryRecordsFromProduct(product, { session });

      const inserted = await InventoryAdjustment.insertMany(adjustments, saveOptions(session));
      return {
        batchId,
        productId: product._id,
        reason,
        lineCount: inserted.length,
        adjustments: inserted,
      };
    });
  }

  buildVariantLabel(variant = {}) {
    const color = variant?.color?.name?.toString().trim();
    const size = variant?.sizeLabel?.toString().trim() || variant?.size?.toString().trim();
    if (color && size) return `${color} / ${size}`;
    return color || size || variant?.sku || "";
  }

  async list({ page = 1, limit = 20, productId, reason, from, to } = {}) {
    const query = {};
    if (productId) query.productId = productId;
    if (reason) query.reason = reason;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }
    return InventoryAdjustment.paginate(query, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      sort: { createdAt: -1 },
      populate: [
        { path: "productId", select: "_id name slug media" },
        { path: "purchaseOrderId", select: "_id poNumber" },
        { path: "supplierId", select: "_id name type" },
        { path: "createdBy", select: "_id fullName email" },
      ],
    });
  }
}

export default new InventoryAdjustmentService();
