import express from "express";
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

// Get brand config
router.get("/:brandKey", validateRequest(getBrandConfigValidation), getBrandConfig);

// Update brand config
router.put(
  "/:brandKey",
  validateRequest(updateBrandConfigValidation),
  updateBrandConfig,
);

export default router;
