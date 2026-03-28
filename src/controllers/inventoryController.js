import { asyncHandler, sendSuccess, getPaginationParams } from "../utils/helpers.js";
import inventoryService from "../services/inventoryService.js";
import { getSocketServer } from "../sockets/socketGateway.js";

export const getLowStockItems = asyncHandler(async (req, res) => {
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);
  const items = await inventoryService.getLowStockItems({
    page,
    limit,
    threshold: req.query.threshold,
  });

  sendSuccess(res, 200, items, "Low stock items retrieved");
});

export const getInventoryByVariantSku = asyncHandler(async (req, res) => {
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);
  const inventory = await inventoryService.getInventoryByVariantSku(
    req.params.variantSku,
    {
      page,
      limit,
    },
  );

  sendSuccess(res, 200, inventory, "Inventory retrieved");
});

export const updateInventory = asyncHandler(async (req, res) => {
  const inventory = await inventoryService.updateInventory(req.params.variantSku, req.body);
  const io = getSocketServer();
  const productId = inventory.productId?.toString?.() || "";
  if (io?.emitInventoryUpdate && productId) {
    io.emitInventoryUpdate(productId, {
      action: "inventory_updated",
      source: "inventory_controller",
      productId,
      variantSku: inventory.variantSku || req.params.variantSku,
      onHand: Number(inventory.onHand || 0),
      reserved: Number(inventory.reserved || 0),
      available: Number(inventory.available || 0),
      incoming: Number(inventory.incoming || 0),
      updatedAt: inventory.updatedAt || new Date(),
    });
  }
  sendSuccess(res, 200, inventory, "Inventory updated");
});
