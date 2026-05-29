import aiRecommendationService from "./aiRecommendationService.js";
import { generateShoppingChatReplyWithGemini } from "./geminiShoppingChatProvider.js";

const DEFAULT_LIMIT = 4;
const MIN_MESSAGE_LENGTH = 2;
const MAX_HISTORY_ITEMS = 8;

const DEFAULT_SUGGESTED_QUESTIONS = [
  "Áo đi làm dưới 500k",
  "Đồ đi chơi cuối tuần",
  "Sản phẩm màu đen size M",
];

const toSafeString = (value = "", maxLength = 500) =>
  value
    ?.toString?.()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength) || "";

const sanitizeHistory = (history = []) => {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .slice(-MAX_HISTORY_ITEMS)
    .map((item) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: toSafeString(item?.content, 500),
    }))
    .filter((item) => item.content);
};

const buildFallbackReply = ({ recommendations, summary }) => {
  if (!recommendations.length) {
    return "Mình chưa tìm thấy sản phẩm thật sự khớp với nhu cầu này. Bạn cho mình thêm loại sản phẩm, ngân sách, màu hoặc size để lọc chính xác hơn nhé.";
  }

  const names = recommendations
    .slice(0, 3)
    .map((item) => item.product?.name)
    .filter(Boolean);

  const productText =
    names.length > 1
      ? `${names.slice(0, -1).join(", ")} và ${names[names.length - 1]}`
      : names[0];

  return `${summary} Mình gợi ý ${productText}; bạn có thể mở từng sản phẩm bên dưới để xem màu, size và giá hiện tại.`;
};

export class AiShoppingChatService {
  async chat({ message, history = [], context = {} } = {}) {
    const trimmedMessage = toSafeString(message, 500);
    const safeHistory = sanitizeHistory(history);

    if (trimmedMessage.length < MIN_MESSAGE_LENGTH) {
      return {
        message: trimmedMessage,
        reply: "Bạn mô tả nhu cầu mua sắm rõ hơn một chút nhé, ví dụ loại sản phẩm, ngân sách, màu hoặc size.",
        provider: "rules",
        recommendationSummary: "",
        items: [],
        suggestedQuestions: DEFAULT_SUGGESTED_QUESTIONS,
      };
    }

    const recommendationResult = await aiRecommendationService.recommendProducts({
      message: trimmedMessage,
      limit: DEFAULT_LIMIT,
      context,
    });

    let provider = recommendationResult.provider ?? "rules";
    let reply = buildFallbackReply({
      recommendations: recommendationResult.items,
      summary: recommendationResult.summary,
    });
    let suggestedQuestions = DEFAULT_SUGGESTED_QUESTIONS;

    try {
      const geminiReply = await generateShoppingChatReplyWithGemini({
        message: trimmedMessage,
        history: safeHistory,
        recommendationSummary: recommendationResult.summary,
        recommendations: recommendationResult.items,
      });

      if (geminiReply?.reply) {
        provider = "gemini";
        reply = geminiReply.reply;
        suggestedQuestions =
          geminiReply.suggestedQuestions.length > 0
            ? geminiReply.suggestedQuestions
            : suggestedQuestions;
      }
    } catch (error) {
      if (process.env.AI_RECOMMENDATION_DEBUG === "true") {
        console.warn("[ai-chat] Gemini fallback:", error?.message || error);
      }
    }

    return {
      message: trimmedMessage,
      reply,
      provider,
      recommendationSummary: recommendationResult.summary,
      items: recommendationResult.items,
      suggestedQuestions,
    };
  }
}

export default new AiShoppingChatService();
