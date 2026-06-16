import express from "express";
import { authenticateToken, authorizeRole } from "../middlewares/auth.js";
import {
  adjustInventory,
  listInventoryAdjustments,
} from "../controllers/inventoryAdjustmentController.js";

const router = express.Router();

router.use(authenticateToken);
router.use(authorizeRole("superadmin", "manager", "warehouse"));

router.post("/", adjustInventory);
router.get("/", listInventoryAdjustments);

export default router;
