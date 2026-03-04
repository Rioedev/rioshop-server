import express from "express";
const router = express.Router();
import { register, login } from "../controllers/auth.controller.js";
import { registerSchema, loginSchema } from "../validations/auth.validation.js";

router.post("/register", register);
router.post("/login", login);

export default router;