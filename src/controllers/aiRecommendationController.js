import { asyncHandler, sendSuccess } from "../utils/helpers.js";
import aiRecommendationService from "../services/aiRecommendationService.js";
import aiShoppingChatService from "../services/aiShoppingChatService.js";

export const recommendProducts = asyncHandler(async (req, res) => {
  const result = await aiRecommendationService.recommendProducts({
    message: req.body.message,
    limit: req.body.limit,
    context: req.body.context,
  });

  sendSuccess(res, 200, result, "Product recommendations generated");
});

export const chatWithShoppingAssistant = asyncHandler(async (req, res) => {
  const result = await aiShoppingChatService.chat({
    message: req.body.message,
    history: req.body.history,
    context: req.body.context,
  });

  sendSuccess(res, 200, result, "Shopping chat response generated");
});
