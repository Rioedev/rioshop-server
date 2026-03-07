import { asyncHandler, sendSuccess, sendError } from "../utils/helpers.js";
import authService from "../services/authService.js";
import Admin from "../models/Admin.js";

/**
 * POST /api/admins/login
 * Admin login
 */
export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate inputs
  if (!email || !password) {
    return sendError(res, 400, "Email and password are required");
  }

  // Login admin
  const result = await authService.loginAdmin(email, password);

  sendSuccess(res, 200, result, "Admin login successful");
});

/**
 * POST /api/admins/logout
 * Admin logout
 */
export const adminLogout = asyncHandler(async (req, res) => {
  const { adminId } = req.user; // From JWT token
  const token = req.headers.authorization?.split(" ")[1];

  if (adminId && token) {
    await authService.logoutUser(adminId, token);
  }

  sendSuccess(res, 200, {}, "Admin logout successful");
});

/**
 * GET /api/admins/me
 * Get current admin info
 */
export const getCurrentAdmin = asyncHandler(async (req, res) => {
  const { adminId } = req.user;

  const admin = await Admin.findById(adminId).select("-passwordHash");

  if (!admin) {
    return sendError(res, 404, "Admin not found");
  }

  sendSuccess(res, 200, admin, "Admin fetched successfully");
});

/**
 * POST /api/admins/change-password
 * Change admin password
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { adminId } = req.user;
  const { oldPassword, newPassword, confirmPassword } = req.body;

  // Validate inputs
  if (!oldPassword || !newPassword) {
    return sendError(res, 400, "Old and new passwords are required");
  }

  if (newPassword !== confirmPassword) {
    return sendError(res, 400, "Passwords do not match");
  }

  if (newPassword.length < 6) {
    return sendError(res, 400, "Password must be at least 6 characters");
  }

  await authService.changePassword(adminId, oldPassword, newPassword, true);

  sendSuccess(res, 200, {}, "Password changed successfully");
});

/**
 * GET /api/admins
 * Get all admins (superadmin only)
 */
export const getAllAdmins = asyncHandler(async (req, res) => {
  const admins = await Admin.find().select("-passwordHash");

  sendSuccess(res, 200, admins, "Admins retrieved successfully");
});

/**
 * GET /api/admins/:id
 * Get admin by ID (superadmin only)
 */
export const getAdminById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const admin = await Admin.findById(id).select("-passwordHash");

  if (!admin) {
    return sendError(res, 404, "Admin not found");
  }

  sendSuccess(res, 200, admin, "Admin retrieved successfully");
});

/**
 * POST /api/admins
 * Create new admin (superadmin only)
 */
export const createAdmin = asyncHandler(async (req, res) => {
  const { email, password, fullName, role, permissions } = req.body;

  // Validate inputs
  if (!email || !password || !fullName || !role) {
    return sendError(res, 400, "All fields are required");
  }

  if (password.length < 6) {
    return sendError(res, 400, "Password must be at least 6 characters");
  }

  // Check if admin already exists
  const existing = await Admin.findOne({ email: email.toLowerCase() });
  if (existing) {
    return sendError(res, 409, "Admin with this email already exists");
  }

  // Create admin using service
  const result = await authService.registerAdmin({
    email,
    password,
    fullName,
    role,
    permissions: permissions || [],
  });

  sendSuccess(res, 201, result.admin, "Admin created successfully");
});

/**
 * PUT /api/admins/:id
 * Update admin (superadmin only)
 */
export const updateAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { fullName, role, permissions, isActive } = req.body;

  // Check if admin exists
  const admin = await Admin.findById(id);
  if (!admin) {
    return sendError(res, 404, "Admin not found");
  }

  // Update fields
  const updateData = {};
  if (fullName) updateData.fullName = fullName;
  if (role) updateData.role = role;
  if (permissions) updateData.permissions = permissions;
  if (isActive !== undefined) updateData.isActive = isActive;
  updateData.updatedAt = new Date();

  const updatedAdmin = await Admin.findByIdAndUpdate(id, updateData, {
    new: true,
  }).select("-passwordHash");

  sendSuccess(res, 200, updatedAdmin, "Admin updated successfully");
});

/**
 * DELETE /api/admins/:id
 * Delete admin (superadmin only)
 */
export const deleteAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { adminId } = req.user;

  // Prevent self-deletion
  if (id === adminId) {
    return sendError(res, 400, "Cannot delete your own admin account");
  }

  // Check if admin exists
  const admin = await Admin.findById(id);
  if (!admin) {
    return sendError(res, 404, "Admin not found");
  }

  // Delete admin
  await Admin.findByIdAndDelete(id);

  sendSuccess(res, 200, {}, "Admin deleted successfully");
});
