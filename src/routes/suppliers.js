import express from "express";
import { authenticateToken, authorizeRole } from "../middlewares/auth.js";
import {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../controllers/supplierController.js";

const router = express.Router();

// Toàn bộ supplier dành cho admin
router.use(authenticateToken);
router.use(authorizeRole("superadmin", "manager", "warehouse"));

router.get("/", listSuppliers);
router.get("/:id", getSupplier);
router.post("/", createSupplier);
router.put("/:id", updateSupplier);
router.delete("/:id", deleteSupplier);

export default router;
