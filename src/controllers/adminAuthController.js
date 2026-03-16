import { asyncHandler, sendSuccess, sendError } from "../utils/helpers.js";
import authService from "../services/authService.js";
import Admin from "../models/Admin.js";

const STAFF_ROLES = ["warehouse", "cs", "marketer", "sales"];
const NOT_DELETED_FILTER = {
  $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
};

const canAssignRole = (actorRole, targetRole) => {
  if (actorRole === "superadmin") {
    return true;
  }

  if (actorRole === "manager") {
    return STAFF_ROLES.includes(targetRole);
  }

  return false;
};

const canManageTargetAdmin = (actorRole, targetAdminRole) => {
  if (actorRole === "superadmin") {
    return true;
  }

  if (actorRole === "manager") {
    return STAFF_ROLES.includes(targetAdminRole);
  }

  return false;
};

/**
 * POST /api/admins/login
 * Admin login
 */
export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return sendError(res, 400, "Email and password are required");
  }

  const result = await authService.loginAdmin(email, password);
  sendSuccess(res, 200, result, "Admin login successful");
});

/**
 * POST /api/admins/logout
 * Admin logout
 */
export const adminLogout = asyncHandler(async (req, res) => {
  const { adminId } = req.user;
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
  if (!admin || admin.isDeleted) {
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
 * Get admin accounts
 * - superadmin: all admin accounts
 * - manager: staff roles only
 */
export const getAllAdmins = asyncHandler(async (req, res) => {
  const actorRole = req.user.role;
  const query = actorRole === "superadmin"
    ? { ...NOT_DELETED_FILTER }
    : {
        role: { $in: STAFF_ROLES },
        ...NOT_DELETED_FILTER,
      };

  const admins = await Admin.find(query).select("-passwordHash");
  sendSuccess(res, 200, admins, "Admins retrieved successfully");
});

/**
 * GET /api/admins/:id
 * Get admin by ID
 */
export const getAdminById = asyncHandler(async (req, res) => {
  const actorRole = req.user.role;
  const { id } = req.params;

  const admin = await Admin.findOne({
    _id: id,
    ...NOT_DELETED_FILTER,
  }).select("-passwordHash");
  if (!admin) {
    return sendError(res, 404, "Admin not found");
  }

  if (!canManageTargetAdmin(actorRole, admin.role)) {
    return sendError(res, 403, "You do not have permission to view this admin account");
  }

  sendSuccess(res, 200, admin, "Admin retrieved successfully");
});

/**
 * POST /api/admins
 * Create admin account
 */
export const createAdmin = asyncHandler(async (req, res) => {
  const actorRole = req.user.role;
  const { adminId } = req.user;
  const { email, password, fullName, role, permissions } = req.body;

  if (!email || !password || !fullName || !role) {
    return sendError(res, 400, "All fields are required");
  }

  if (password.length < 6) {
    return sendError(res, 400, "Password must be at least 6 characters");
  }

  if (!canAssignRole(actorRole, role)) {
    return sendError(res, 403, "You do not have permission to create this role");
  }

  const existing = await Admin.findOne({ email: email.toLowerCase() });
  if (existing) {
    return sendError(res, 409, "Admin with this email already exists");
  }

  const result = await authService.registerAdmin({
    email,
    password,
    fullName,
    role,
    permissions: permissions || [],
    createdBy: adminId,
  });

  sendSuccess(res, 201, result.admin, "Admin created successfully");
});

/**
 * PUT /api/admins/:id
 * Update admin account
 */
export const updateAdmin = asyncHandler(async (req, res) => {
  const actorRole = req.user.role;
  const { id } = req.params;
  const { fullName, role, permissions, isActive } = req.body;

  const admin = await Admin.findOne({
    _id: id,
    ...NOT_DELETED_FILTER,
  });
  if (!admin) {
    return sendError(res, 404, "Admin not found");
  }

  if (!canManageTargetAdmin(actorRole, admin.role)) {
    return sendError(res, 403, "You do not have permission to update this admin account");
  }

  if (role && !canAssignRole(actorRole, role)) {
    return sendError(res, 403, "You do not have permission to assign this role");
  }

  const updateData = {};
  if (fullName) updateData.fullName = fullName;
  if (role) updateData.role = role;
  if (permissions) updateData.permissions = permissions;
  if (isActive !== undefined) updateData.isActive = isActive;
  updateData.updatedAt = new Date();

  const updatedAdmin = await Admin.findOneAndUpdate(
    {
      _id: id,
      ...NOT_DELETED_FILTER,
    },
    updateData,
    { new: true },
  ).select("-passwordHash");

  sendSuccess(res, 200, updatedAdmin, "Admin updated successfully");
});

/**
 * DELETE /api/admins/:id
 * Delete admin account
 */
export const deleteAdmin = asyncHandler(async (req, res) => {
  const actorRole = req.user.role;
  const { id } = req.params;
  const { adminId } = req.user;

  if (id === adminId) {
    return sendError(res, 400, "Cannot delete your own admin account");
  }

  const admin = await Admin.findOne({
    _id: id,
    ...NOT_DELETED_FILTER,
  });
  if (!admin) {
    return sendError(res, 404, "Admin not found");
  }

  if (!canManageTargetAdmin(actorRole, admin.role)) {
    return sendError(res, 403, "You do not have permission to delete this admin account");
  }

  const deletedAdmin = await Admin.findOneAndUpdate(
    {
      _id: id,
      ...NOT_DELETED_FILTER,
    },
    {
      isActive: false,
      isDeleted: true,
      deletedAt: new Date(),
      updatedAt: new Date(),
    },
    { new: true },
  ).select("-passwordHash");

  sendSuccess(res, 200, deletedAdmin, "Admin soft deleted successfully");
});
