import express from "express";
import { register, login } from "../controllers/auth.controller.js";
import { createValidationMiddleware } from "../middlewares/validation.middleware.js";
import { registerSchema, loginSchema } from "../validations/auth.validation.js";

const router = express.Router();

/**
 * Register new user
 * POST /api/auth/register
 */
router.post("/register", createValidationMiddleware(registerSchema), register);

/**
 * Login user
 * POST /api/auth/login
 */
router.post("/login", createValidationMiddleware(loginSchema), login);

export default router;
