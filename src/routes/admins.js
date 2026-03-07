import express from "express";
import { asyncHandler, sendSuccess } from "../utils/helpers.js";
import { authenticateToken, authorizeRole } from "../middlewares/auth.js";

const router = express.Router();

// Get all admins
router.get(
  "/",
  authenticateToken,
  authorizeRole("superadmin"),
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, { admins: [] }, "Admins retrieved");
  }),
);

// Create admin
router.post(
  "/",
  authenticateToken,
  authorizeRole("superadmin"),
  asyncHandler(async (req, res) => {
    sendSuccess(res, 201, {}, "Admin created");
  }),
);

// Update admin
router.put(
  "/:id",
  authenticateToken,
  authorizeRole("superadmin"),
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Admin updated");
  }),
);

// Delete admin
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("superadmin"),
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Admin deleted");
  }),
);

export default router;
