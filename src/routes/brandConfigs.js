import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validation.js";
import {
  getBrandConfig,
  updateBrandConfig,
} from "../controllers/brandConfigController.js";
import {
  getBrandConfigValidation,
  updateBrandConfigValidation,
} from "../validations/brandConfigs.js";

const router = express.Router();

// Public: storefront cần đọc brand config (logo, hotline, footer...)
router.get("/:brandKey", validateRequest(getBrandConfigValidation), getBrandConfig);

// Admin only
router.put(
  "/:brandKey",
  authenticateToken,
  validateRequest(updateBrandConfigValidation),
  updateBrandConfig,
);

export default router;
