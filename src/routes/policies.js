import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  listPolicies,
  listActiveByKind,
  getActivePageBySlug,
  createPolicy,
  updatePolicy,
  deletePolicy,
} from "../controllers/policyController.js";

const router = express.Router();

// Public: list active policies by kind (used by storefront header strip + footer)
router.get("/active/:kind", listActiveByKind);

// Public: fetch a single active policy page by slug
router.get("/pages/:slug", getActivePageBySlug);

// Admin: full CRUD list with filters (kind, isActive) — yêu cầu auth
router.get("/", authenticateToken, listPolicies);
router.post("/", authenticateToken, createPolicy);
router.put("/:id", authenticateToken, updatePolicy);
router.delete("/:id", authenticateToken, deletePolicy);

export default router;
