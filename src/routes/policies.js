import express from "express";
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

// Admin: full CRUD list with filters (kind, isActive)
router.get("/", listPolicies);
router.post("/", createPolicy);
router.put("/:id", updatePolicy);
router.delete("/:id", deletePolicy);

export default router;
