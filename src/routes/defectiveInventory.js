import express from "express";
import { authenticateToken, authorizeRole } from "../middlewares/auth.js";
import {
  listDefectiveInventory,
  updateDefectiveInventoryStatus,
} from "../controllers/defectiveInventoryController.js";

const router = express.Router();
router.use(authenticateToken);
router.use(authorizeRole("superadmin", "manager", "warehouse"));
router.get("/", listDefectiveInventory);
router.patch("/:id/status", updateDefectiveInventoryStatus);

export default router;
