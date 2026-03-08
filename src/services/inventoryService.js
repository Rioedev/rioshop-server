import Inventory from "../models/Inventory.js";
import { AppError } from "../utils/helpers.js";

export class InventoryService {
  async getInventoryByVariantSku(variantSku, options = {}) {
    const { page = 1, limit = 50, warehouseId } = options;
    const query = { variantSku };

    if (warehouseId) {
      query.warehouseId = warehouseId;
    }

    try {
      const skip = (page - 1) * limit;
      const [items, totalDocs] = await Promise.all([
        Inventory.find(query)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate([{ path: "productId", select: "_id name sku slug media" }]),
        Inventory.countDocuments(query),
      ]);

      const summary = items.reduce(
        (acc, item) => {
          acc.onHand += item.onHand || 0;
          acc.reserved += item.reserved || 0;
          acc.available += item.available || 0;
          acc.incoming += item.incoming || 0;
          return acc;
        },
        { onHand: 0, reserved: 0, available: 0, incoming: 0 },
      );

      return {
        docs: items,
        summary,
        totalDocs,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalDocs / limit)),
        hasPrevPage: page > 1,
        hasNextPage: skip + items.length < totalDocs,
      };
    } catch (error) {
      throw error;
    }
  }

  async updateInventory(variantSku, data = {}) {
    try {
      const query = { variantSku };
      if (data.productId) query.productId = data.productId;
      if (data.warehouseId) query.warehouseId = data.warehouseId;

      let inventory = await Inventory.findOne(query);

      if (!inventory) {
        if (!data.productId || !data.warehouseId || !data.warehouseName) {
          throw new AppError(
            "productId, warehouseId and warehouseName are required when creating inventory",
            400,
          );
        }

        inventory = new Inventory({
          productId: data.productId,
          variantSku,
          warehouseId: data.warehouseId,
          warehouseName: data.warehouseName,
          onHand: 0,
          reserved: 0,
          available: 0,
          incoming: 0,
        });
      }

      if (data.warehouseName !== undefined) inventory.warehouseName = data.warehouseName;
      if (data.onHand !== undefined) inventory.onHand = Number(data.onHand);
      if (data.reserved !== undefined) inventory.reserved = Number(data.reserved);
      if (data.incoming !== undefined) inventory.incoming = Number(data.incoming);
      if (data.reorderPoint !== undefined) inventory.reorderPoint = Number(data.reorderPoint);
      if (data.reorderQty !== undefined) inventory.reorderQty = Number(data.reorderQty);
      if (data.lastCountAt !== undefined) {
        inventory.lastCountAt = data.lastCountAt ? new Date(data.lastCountAt) : null;
      }

      inventory.available = Math.max(0, (inventory.onHand || 0) - (inventory.reserved || 0));
      inventory.lowStockAlert =
        data.lowStockAlert !== undefined
          ? Boolean(data.lowStockAlert)
          : inventory.reorderPoint !== undefined &&
            inventory.reorderPoint !== null &&
            inventory.available <= inventory.reorderPoint;
      inventory.updatedAt = new Date();

      await inventory.save();
      return inventory;
    } catch (error) {
      throw error;
    }
  }

  async getLowStockItems(options = {}) {
    const { page = 1, limit = 50, threshold } = options;
    const query = {};

    if (threshold !== undefined && threshold !== null) {
      query.available = { $lte: Number(threshold) };
    } else {
      query.lowStockAlert = true;
    }

    try {
      const skip = (page - 1) * limit;
      const [items, totalDocs] = await Promise.all([
        Inventory.find(query)
          .sort({ available: 1, updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate([{ path: "productId", select: "_id name sku slug" }]),
        Inventory.countDocuments(query),
      ]);

      return {
        docs: items,
        totalDocs,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalDocs / limit)),
        hasPrevPage: page > 1,
        hasNextPage: skip + items.length < totalDocs,
      };
    } catch (error) {
      throw error;
    }
  }

  async adjustReservedStock(variantSku, warehouseId, delta) {
    try {
      const inventory = await Inventory.findOne({ variantSku, warehouseId });
      if (!inventory) {
        throw new AppError("Inventory record not found", 404);
      }

      inventory.reserved = Math.max(0, (inventory.reserved || 0) + Number(delta || 0));
      inventory.available = Math.max(0, (inventory.onHand || 0) - inventory.reserved);
      inventory.lowStockAlert =
        inventory.reorderPoint !== undefined &&
        inventory.reorderPoint !== null &&
        inventory.available <= inventory.reorderPoint;
      inventory.updatedAt = new Date();

      await inventory.save();
      return inventory;
    } catch (error) {
      throw error;
    }
  }
}

export default new InventoryService();
