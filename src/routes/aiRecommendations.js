import express from "express";
import { validateRequest } from "../middlewares/validation.js";
import {
  chatWithShoppingAssistant,
  recommendProducts,
} from "../controllers/aiRecommendationController.js";
import {
  aiShoppingChatValidation,
  recommendProductsValidation,
} from "../validations/aiRecommendations.js";

const router = express.Router();

router.post(
  "/recommend-products",
  validateRequest(recommendProductsValidation),
  recommendProducts,
);

router.post(
  "/chat",
  validateRequest(aiShoppingChatValidation),
  chatWithShoppingAssistant,
);

export default router;
