import express from "express";
import { validateRequest } from "../middlewares/validation.js";
import {
  getLowStockItems,
  getInventoryByVariantSku,
  updateInventory,
  updateInventoryRulesByProduct,
} from "../controllers/inventoryController.js";
import {
  getLowStockValidation,
  getInventoryBySkuValidation,
  updateInventoryRulesByProductValidation,
  updateInventoryValidation,
} from "../validations/inventories.js";

const router = express.Router();

// Get low stock items
router.get("/", validateRequest(getLowStockValidation), getLowStockItems);

// Apply inventory rules to all variants of a product
router.put(
  "/product/:productId/rules",
  validateRequest(updateInventoryRulesByProductValidation),
  updateInventoryRulesByProduct,
);

// Get inventory
router.get(
  "/:variantSku",
  validateRequest(getInventoryBySkuValidation),
  getInventoryByVariantSku,
);

// Update inventory
router.put("/:variantSku", validateRequest(updateInventoryValidation), updateInventory);

export default router;
