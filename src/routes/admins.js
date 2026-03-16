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
import {
  adminCustomerListValidation,
  customerIdValidation,
  createCustomerByAdminValidation,
  updateCustomerByAdminValidation,
  updateCustomerStatusByAdminValidation,
} from "../validations/users.js";
import {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  updateCustomerStatus,
  softDeleteCustomer,
} from "../controllers/userController.js";

const router = express.Router();

// Public routes
// Admin login
router.post("/login", validateRequest(adminLoginValidation), adminLogin);

// Protected routes (requires authentication)
// Get current admin
router.get(
  "/me",
  authenticateToken,
  authorizeRole("superadmin", "manager", "warehouse", "cs", "marketer", "sales"),
  getCurrentAdmin,
);

// Admin logout
router.post(
  "/logout",
  authenticateToken,
  authorizeRole("superadmin", "manager", "warehouse", "cs", "marketer", "sales"),
  adminLogout,
);

// Change password
router.post(
  "/change-password",
  authenticateToken,
  authorizeRole("superadmin", "manager", "warehouse", "cs", "marketer", "sales"),
  validateRequest(adminChangePasswordValidation),
  changePassword,
);

// Customer user management routes
router.get(
  "/users",
  authenticateToken,
  authorizeRole("superadmin", "manager", "cs"),
  validateRequest(adminCustomerListValidation),
  getAllCustomers,
);

router.get(
  "/users/:id",
  authenticateToken,
  authorizeRole("superadmin", "manager", "cs"),
  validateRequest(customerIdValidation),
  getCustomerById,
);

router.post(
  "/users",
  authenticateToken,
  authorizeRole("superadmin", "manager"),
  validateRequest(createCustomerByAdminValidation),
  createCustomer,
);

router.put(
  "/users/:id",
  authenticateToken,
  authorizeRole("superadmin", "manager", "cs"),
  validateRequest(updateCustomerByAdminValidation),
  updateCustomer,
);

router.patch(
  "/users/:id/status",
  authenticateToken,
  authorizeRole("superadmin", "manager", "cs"),
  validateRequest(updateCustomerStatusByAdminValidation),
  updateCustomerStatus,
);

router.delete(
  "/users/:id",
  authenticateToken,
  authorizeRole("superadmin", "manager"),
  validateRequest(customerIdValidation),
  softDeleteCustomer,
);

// Admin account management routes
// superadmin: full access
// manager: staff roles only
router.get("/", authenticateToken, authorizeRole("superadmin", "manager"), getAllAdmins);

// Get admin by ID
router.get(
  "/:id",
  authenticateToken,
  authorizeRole("superadmin", "manager"),
  getAdminById,
);

// Create new admin
router.post(
  "/",
  authenticateToken,
  authorizeRole("superadmin", "manager"),
  validateRequest(createAdminValidation),
  createAdmin,
);

// Update admin
router.put(
  "/:id",
  authenticateToken,
  authorizeRole("superadmin", "manager"),
  validateRequest(updateAdminValidation),
  updateAdmin,
);

// Delete admin
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("superadmin", "manager"),
  deleteAdmin,
);

export default router;
