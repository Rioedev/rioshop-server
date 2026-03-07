import express from "express";
import { asyncHandler, sendSuccess } from "../utils/helpers.js";
import { generateToken } from "../middlewares/auth.js";

const router = express.Router();

// Register
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { email, password, fullName } = req.body;
    // TODO: Implement registration logic
    sendSuccess(res, 201, {}, "User registered successfully");
  }),
);

// Login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    // TODO: Implement login logic
    const token = generateToken({ userId: "user_id", role: "user" });
    sendSuccess(res, 200, { token }, "Login successful");
  }),
);

// Logout
router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Logout successful");
  }),
);

export default router;
