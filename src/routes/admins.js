import express from "express";
import {
  adminLogin,
  adminLogout,
  getCurrentAdmin,
  changePassword,
  getAllAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  deleteAdmin,
} from "../controllers/adminAuthController.js";
import { authenticateToken, authorizeRole } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validation.js";
import {
  adminLoginValidation,
  adminChangePasswordValidation,
  createAdminValidation,
  updateAdminValidation,
} from "../validations/admin.js";

const router = express.Router();

// Public routes
// Admin login
router.post("/login", validateRequest(adminLoginValidation), adminLogin);

// Protected routes (requires authentication)
// Get current admin
router.get(
  "/me",
  authenticateToken,
  authorizeRole("superadmin", "manager", "warehouse", "cs", "marketer"),
  getCurrentAdmin,
);

// Admin logout
router.post(
  "/logout",
  authenticateToken,
  authorizeRole("superadmin", "manager", "warehouse", "cs", "marketer"),
  adminLogout,
);

// Change password
router.post(
  "/change-password",
  authenticateToken,
  authorizeRole("superadmin", "manager", "warehouse", "cs", "marketer"),
  validateRequest(adminChangePasswordValidation),
  changePassword,
);

// Superadmin only routes
// Get all admins
router.get("/", authenticateToken, authorizeRole("superadmin"), getAllAdmins);

// Get admin by ID
router.get(
  "/:id",
  authenticateToken,
  authorizeRole("superadmin"),
  getAdminById,
);

// Create new admin
router.post(
  "/",
  authenticateToken,
  authorizeRole("superadmin"),
  validateRequest(createAdminValidation),
  createAdmin,
);

// Update admin
router.put(
  "/:id",
  authenticateToken,
  authorizeRole("superadmin"),
  validateRequest(updateAdminValidation),
  updateAdmin,
);

// Delete admin
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("superadmin"),
  deleteAdmin,
);

export default router;
