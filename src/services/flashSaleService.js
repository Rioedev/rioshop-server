import FlashSale from "../models/FlashSale.js";
import { AppError } from "../utils/helpers.js";

export class FlashSaleService {
  async getAllFlashSales(filters = {}, options = {}) {
    const { page = 1, limit = 20, sort = { startsAt: -1 } } = options;
    const query = {};

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters.currentOnly) {
      const now = new Date();
      query.startsAt = { $lte: now };
      query.endsAt = { $gte: now };
      if (query.isActive === undefined) {
        query.isActive = true;
      }
    }

    try {
      const skip = (page - 1) * limit;
      const [sales, totalDocs] = await Promise.all([
        FlashSale.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate([{ path: "slots.productId", select: "_id name slug media" }]),
        FlashSale.countDocuments(query),
      ]);

      return {
        docs: sales,
        totalDocs,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalDocs / limit)),
        hasPrevPage: page > 1,
        hasNextPage: skip + sales.length < totalDocs,
      };
    } catch (error) {
      throw error;
    }
  }

  async getFlashSaleById(id) {
    try {
      return await FlashSale.findById(id).populate([
        { path: "slots.productId", select: "_id name slug media pricing" },
      ]);
    } catch (error) {
      throw error;
    }
  }

  async createFlashSale(data) {
    try {
      this.validateDateRange(data.startsAt, data.endsAt);

      const flashSale = new FlashSale({
        ...data,
        slots: this.normalizeSlots(data.slots || []),
      });
      await flashSale.save();

      return flashSale;
    } catch (error) {
      throw error;
    }
  }

  async updateFlashSale(id, data) {
    try {
      const existing = await FlashSale.findById(id);
      if (!existing) {
        throw new AppError("Flash sale not found", 404);
      }

      const startsAt = data.startsAt || existing.startsAt;
      const endsAt = data.endsAt || existing.endsAt;
      this.validateDateRange(startsAt, endsAt);

      const updateData = {
        ...data,
      };

      if (updateData.slots) {
        updateData.slots = this.normalizeSlots(updateData.slots);
      }

      return await FlashSale.findByIdAndUpdate(id, updateData, { new: true });
    } catch (error) {
      throw error;
    }
  }

  async deleteFlashSale(id) {
    try {
      return await FlashSale.findByIdAndDelete(id);
    } catch (error) {
      throw error;
    }
  }

  async reserveStock(flashSaleId, payload = {}) {
    const { productId, variantSku = "", quantity = 1 } = payload;

    try {
      const flashSale = await FlashSale.findById(flashSaleId);
      if (!flashSale) {
        throw new AppError("Flash sale not found", 404);
      }

      const now = new Date();
      if (!flashSale.isActive || flashSale.startsAt > now || flashSale.endsAt < now) {
        throw new AppError("Flash sale is not active", 400);
      }

      const slot = (flashSale.slots || []).find((item) => {
        const sameProduct = item.productId?.toString() === productId?.toString();
        const sameSku = (item.variantSku || "") === (variantSku || "");
        return sameProduct && sameSku;
      });

      if (!slot) {
        throw new AppError("Flash sale slot not found", 404);
      }

      const qty = Number(quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new AppError("Quantity must be greater than zero", 400);
      }

      if (slot.sold + qty > slot.stockLimit) {
        throw new AppError("Flash sale stock limit exceeded", 400);
      }

      slot.sold += qty;
      await flashSale.save();

      return flashSale;
    } catch (error) {
      throw error;
    }
  }

  validateDateRange(startsAt, endsAt) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new AppError("Invalid flash sale date range", 400);
    }

    if (start >= end) {
      throw new AppError("Flash sale end date must be later than start date", 400);
    }
  }

  normalizeSlots(slots = []) {
    return slots.map((slot) => ({
      productId: slot.productId,
      variantSku: slot.variantSku || "",
      salePrice: Number(slot.salePrice || 0),
      stockLimit: Number(slot.stockLimit || 0),
      sold: Number(slot.sold || 0),
    }));
  }
}

export default new FlashSaleService();
