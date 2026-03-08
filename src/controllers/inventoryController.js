import { asyncHandler, sendSuccess, getPaginationParams } from "../utils/helpers.js";
import inventoryService from "../services/inventoryService.js";

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
      warehouseId: req.query.warehouseId,
    },
  );

  sendSuccess(res, 200, inventory, "Inventory retrieved");
});

export const updateInventory = asyncHandler(async (req, res) => {
  const inventory = await inventoryService.updateInventory(req.params.variantSku, req.body);
  sendSuccess(res, 200, inventory, "Inventory updated");
});
