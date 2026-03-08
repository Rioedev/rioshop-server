import express from "express";
import { validateRequest } from "../middlewares/validation.js";
import {
  getAllFlashSales,
  getFlashSaleById,
  createFlashSale,
} from "../controllers/flashSaleController.js";
import {
  getFlashSalesValidation,
  flashSaleIdValidation,
  createFlashSaleValidation,
} from "../validations/flashSales.js";

const router = express.Router();

// Get all flash sales
router.get("/", validateRequest(getFlashSalesValidation), getAllFlashSales);

// Get flash sale details
router.get("/:id", validateRequest(flashSaleIdValidation), getFlashSaleById);

// Create flash sale
router.post("/", validateRequest(createFlashSaleValidation), createFlashSale);

export default router;
