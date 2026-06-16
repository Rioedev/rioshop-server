import mongoose from "mongoose";
import DefectiveInventory from "../models/DefectiveInventory.js";
import Product from "../models/Product.js";
import inventoryService from "./inventoryService.js";
import { AppError } from "../utils/helpers.js";

const TERMINAL_STATUSES = new Set(["restocked", "returned_supplier", "destroyed"]);
const TRANSITIONS = {
  pending_inspection: new Set(["under_repair", "restocked", "returned_supplier", "destroyed"]),
  under_repair: new Set(["restocked", "returned_supplier", "destroyed"]),
  restocked: new Set(),
  returned_supplier: new Set(),
  destroyed: new Set(),
};

const applySession = (query, session) => (session ? query.session(session) : query);
const saveOptions = (session) => (session ? { session } : undefined);

class DefectiveInventoryService {
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
        const message = String(error?.message || "");
        const unsupported =
          message.includes("Transaction numbers are only allowed") ||
          message.includes("does not support transactions");
        if (!unsupported) throw error;
        await session.endSession();
        shouldEndSession = false;
        return work(null);
      }
    } finally {
      if (shouldEndSession) await session.endSession();
    }
  }

  async list({ page = 1, limit = 20, status, q } = {}) {
    const query = {};
    if (status) query.status = status;
    if (q) {
      const regex = new RegExp(q.toString().trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [
        { sourceOrderNumber: regex },
        { productNameSnapshot: regex },
        { variantSku: regex },
      ];
    }
    return DefectiveInventory.paginate(query, {
      page: Math.max(1, Number(page) || 1),
      limit: Math.min(100, Math.max(1, Number(limit) || 20)),
      sort: { createdAt: -1 },
      populate: [
        { path: "productId", select: "_id name slug media" },
        { path: "sourceOrderId", select: "_id orderNumber" },
      ],
    });
  }

  async updateStatus(id, adminContext, payload = {}) {
    const nextStatus = (payload.status || "").toString().trim();
    const note = (payload.note || "").toString().trim();

    return this.runAtomic(async (session) => {
      const record = await applySession(DefectiveInventory.findById(id), session);
      if (!record) throw new AppError("Defective inventory record not found", 404);
      if (record.status === nextStatus) return record;
      if (TERMINAL_STATUSES.has(record.status) || !TRANSITIONS[record.status]?.has(nextStatus)) {
        throw new AppError(`Cannot change defective inventory status from ${record.status} to ${nextStatus}`, 400);
      }

      if (nextStatus === "restocked") {
        const product = await applySession(
          Product.findOne({ _id: record.productId, deletedAt: null }),
          session,
        );
        if (!product) throw new AppError("Product not found", 404);
        const variant = (product.variants || []).find(
          (item) => (item.sku || "").toString().trim() === record.variantSku,
        );
        if (!variant) throw new AppError(`Variant ${record.variantSku} not found`, 400);

        variant.stock = Number(variant.stock || 0) + Number(record.quantity || 0);
        product.markModified("variants");
        product.updatedAt = new Date();
        await product.save(saveOptions(session));
        await inventoryService.syncInventoryRecordsFromProduct(product, { session });
      }

      record.status = nextStatus;
      record.resolutionNote = note;
      if (TERMINAL_STATUSES.has(nextStatus)) record.resolvedAt = new Date();
      record.timeline.push({
        status: nextStatus,
        note,
        by: adminContext.adminId || null,
        byName: adminContext.adminName || "",
      });
      record.updatedAt = new Date();
      await record.save(saveOptions(session));
      return record;
    });
  }
}

export default new DefectiveInventoryService();
