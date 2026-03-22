import Inventory from "../models/Inventory.js";
import Product from "../models/Product.js";
import { SINGLE_WAREHOUSE_ID, SINGLE_WAREHOUSE_NAME } from "../constants/warehouse.js";
import { AppError } from "../utils/helpers.js";

export class InventoryService {
  async getInventoryByVariantSku(variantSku, options = {}) {
    const { page = 1, limit = 50 } = options;
    const query = { variantSku, warehouseId: SINGLE_WAREHOUSE_ID };

    try {
      const skip = (page - 1) * limit;
      const [items, totalDocs, summaryAgg] = await Promise.all([
        Inventory.find(query)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate([{ path: "productId", select: "_id name sku slug media" }]),
        Inventory.countDocuments(query),
        Inventory.aggregate([
          { $match: query },
          {
            $group: {
              _id: null,
              onHand: { $sum: { $ifNull: ["$onHand", 0] } },
              reserved: { $sum: { $ifNull: ["$reserved", 0] } },
              available: { $sum: { $ifNull: ["$available", 0] } },
              incoming: { $sum: { $ifNull: ["$incoming", 0] } },
            },
          },
        ]),
      ]);

      const summary = summaryAgg[0] || {
        onHand: 0,
        reserved: 0,
        available: 0,
        incoming: 0,
      };

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
      this.assertSingleWarehousePayload(data);

      const query = { variantSku };
      query.warehouseId = SINGLE_WAREHOUSE_ID;

      let inventory = await Inventory.findOne(query);

      if (!inventory) {
        if (!data.productId) {
          throw new AppError(
            "productId is required when creating inventory",
            400,
          );
        }

        await this.assertProductVariantLink(data.productId, variantSku);

        inventory = new Inventory({
          productId: data.productId,
          variantSku,
          warehouseId: SINGLE_WAREHOUSE_ID,
          warehouseName: SINGLE_WAREHOUSE_NAME,
          onHand: 0,
          reserved: 0,
          available: 0,
          incoming: 0,
        });
      } else if (data.productId && data.productId !== inventory.productId?.toString()) {
        throw new AppError(
          "Inventory record already exists for this SKU and warehouse with a different product",
          409,
        );
      }

      inventory.warehouseId = SINGLE_WAREHOUSE_ID;
      inventory.warehouseName = SINGLE_WAREHOUSE_NAME;
      if (data.onHand !== undefined) inventory.onHand = Number(data.onHand);
      if (data.reserved !== undefined) inventory.reserved = Number(data.reserved);
      if (data.incoming !== undefined) inventory.incoming = Number(data.incoming);
      if (data.reorderPoint !== undefined) {
        inventory.reorderPoint =
          data.reorderPoint === null ? null : Number(data.reorderPoint);
      }
      if (data.reorderQty !== undefined) {
        inventory.reorderQty = data.reorderQty === null ? null : Number(data.reorderQty);
      }
      if (data.lastCountAt !== undefined) {
        inventory.lastCountAt = data.lastCountAt ? new Date(data.lastCountAt) : null;
      }

      inventory.available = Math.max(0, (inventory.onHand || 0) - (inventory.reserved || 0));
      inventory.lowStockAlert =
        data.lowStockAlert !== undefined
          ? Boolean(data.lowStockAlert)
          : this.isLowStockByRule(inventory.available, inventory.reorderPoint);
      inventory.updatedAt = new Date();

      await inventory.save();
      await this.syncProductFromSingleWarehouseInventory(inventory.productId);
      return inventory;
    } catch (error) {
      throw error;
    }
  }

  async getLowStockItems(options = {}) {
    const { page = 1, limit = 50, threshold } = options;
    const query = { warehouseId: SINGLE_WAREHOUSE_ID };

    if (threshold !== undefined && threshold !== null) {
      query.available = { $lte: Number(threshold) };
    } else {
      query.$or = [
        { lowStockAlert: true },
        {
          $expr: {
            $and: [
              { $ne: ["$reorderPoint", null] },
              { $lte: ["$available", "$reorderPoint"] },
            ],
          },
        },
      ];
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
      void warehouseId;
      const inventory = await Inventory.findOne({
        variantSku,
        warehouseId: SINGLE_WAREHOUSE_ID,
      });
      if (!inventory) {
        throw new AppError("Inventory record not found", 404);
      }

      inventory.reserved = Math.max(0, (inventory.reserved || 0) + Number(delta || 0));
      inventory.available = Math.max(0, (inventory.onHand || 0) - inventory.reserved);
      inventory.lowStockAlert = this.isLowStockByRule(
        inventory.available,
        inventory.reorderPoint,
      );
      inventory.updatedAt = new Date();

      await inventory.save();
      await this.syncProductFromSingleWarehouseInventory(inventory.productId);
      return inventory;
    } catch (error) {
      throw error;
    }
  }

  isLowStockByRule(available, reorderPoint) {
    if (reorderPoint === undefined || reorderPoint === null) {
      return false;
    }

    return Number(available || 0) <= Number(reorderPoint || 0);
  }

  async assertProductVariantLink(productId, variantSku) {
    const product = await Product.findOne({
      _id: productId,
      deletedAt: null,
    }).select("variants.sku");

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    const normalizedSku = variantSku?.toString().trim();
    const hasVariant = (product.variants || []).some(
      (variant) => (variant.sku || "").trim() === normalizedSku,
    );

    if (!hasVariant) {
      throw new AppError("Variant SKU does not belong to selected product", 400);
    }
  }

  assertSingleWarehousePayload(data = {}) {
    if (data.warehouseId && data.warehouseId !== SINGLE_WAREHOUSE_ID) {
      throw new AppError("Only single warehouse mode is allowed", 400);
    }

    if (data.warehouseName && data.warehouseName !== SINGLE_WAREHOUSE_NAME) {
      throw new AppError("Only single warehouse mode is allowed", 400);
    }
  }

  async syncProductFromSingleWarehouseInventory(productId) {
    const product = await Product.findOne({
      _id: productId,
      deletedAt: null,
    });

    if (!product) {
      return;
    }

    const rows = await Inventory.find({
      productId,
      warehouseId: SINGLE_WAREHOUSE_ID,
    }).select("variantSku available reserved");

    const inventoryBySku = new Map(
      rows.map((row) => [row.variantSku?.toString().trim(), row]),
    );

    const nextVariants = (product.variants || []).map((variant) => {
      const sku = (variant.sku || "").trim();
      const inventoryRow = inventoryBySku.get(sku);
      const nextAvailable = inventoryRow
        ? Math.max(0, Number(inventoryRow.available || 0))
        : Math.max(0, Number(variant.stock || 0));

      return {
        ...variant.toObject(),
        stock: nextAvailable,
      };
    });

    product.variants = nextVariants;

    const available = nextVariants.reduce(
      (sum, variant) => sum + Math.max(0, Number(variant.stock || 0)),
      0,
    );
    const reserved = rows.reduce(
      (sum, row) => sum + Math.max(0, Number(row.reserved || 0)),
      0,
    );

    product.inventorySummary = {
      total: available + reserved,
      available,
      reserved,
    };

    if (product.status === "active" && available <= 0) {
      product.status = "out_of_stock";
    } else if (product.status === "out_of_stock" && available > 0) {
      product.status = "active";
    }

    product.updatedAt = new Date();
    await product.save();
  }
}

export default new InventoryService();
