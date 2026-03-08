import express from "express";
import { validateRequest } from "../middlewares/validation.js";
import {
  getLowStockItems,
  getInventoryByVariantSku,
  updateInventory,
} from "../controllers/inventoryController.js";
import {
  getLowStockValidation,
  getInventoryBySkuValidation,
  updateInventoryValidation,
} from "../validations/inventories.js";

const router = express.Router();

// Get low stock items
router.get("/", validateRequest(getLowStockValidation), getLowStockItems);

// Get inventory
router.get(
  "/:variantSku",
  validateRequest(getInventoryBySkuValidation),
  getInventoryByVariantSku,
);

// Update inventory
router.put("/:variantSku", validateRequest(updateInventoryValidation), updateInventory);

export default router;
