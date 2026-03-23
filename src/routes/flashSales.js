import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validation.js";
import {
  getAllFlashSales,
  getFlashSaleById,
  createFlashSale,
  updateFlashSale,
  deleteFlashSale,
} from "../controllers/flashSaleController.js";
import {
  getFlashSalesValidation,
  flashSaleIdValidation,
  createFlashSaleValidation,
  updateFlashSaleValidation,
} from "../validations/flashSales.js";

const router = express.Router();

// Get all flash sales
router.get("/", validateRequest(getFlashSalesValidation), getAllFlashSales);

// Get flash sale details
router.get("/:id", validateRequest(flashSaleIdValidation), getFlashSaleById);

// Create flash sale
router.post(
  "/",
  authenticateToken,
  validateRequest(createFlashSaleValidation),
  createFlashSale,
);

// Update flash sale
router.put(
  "/:id",
  authenticateToken,
  validateRequest(updateFlashSaleValidation),
  updateFlashSale,
);

// Delete flash sale
router.delete(
  "/:id",
  authenticateToken,
  validateRequest(flashSaleIdValidation),
  deleteFlashSale,
);

export default router;
