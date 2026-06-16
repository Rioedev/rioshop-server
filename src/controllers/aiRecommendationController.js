import { asyncHandler, sendSuccess } from "../utils/helpers.js";
import aiRecommendationService from "../services/aiRecommendationService.js";
import aiShoppingChatService from "../services/aiShoppingChatService.js";
import pricingService from "../services/pricingService.js";

const attachPricingToRecommendationItems = async (items = []) =>
  Promise.all(
    (items || []).map(async (item) => ({
      ...item,
      product: item.product
        ? await pricingService.attachEffectivePricing(item.product)
        : item.product,
    })),
  );

const attachPricingToRecommendationResult = async (result) => ({
  ...result,
  items: await attachPricingToRecommendationItems(result?.items || []),
});

export const recommendProducts = asyncHandler(async (req, res) => {
  const result = await aiRecommendationService.recommendProducts({
    message: req.body.message,
    limit: req.body.limit,
    context: req.body.context,
  });

  const pricedResult = await attachPricingToRecommendationResult(result);
  sendSuccess(res, 200, pricedResult, "Product recommendations generated");
});

export const chatWithShoppingAssistant = asyncHandler(async (req, res) => {
  const result = await aiShoppingChatService.chat({
    message: req.body.message,
    history: req.body.history,
    context: req.body.context,
  });

  const pricedResult = await attachPricingToRecommendationResult(result);
  sendSuccess(res, 200, pricedResult, "Shopping chat response generated");
});
