import {
  extractGeminiJsonObject,
  generateGeminiContent,
  isGeminiConfigured,
  toSafeAiString,
} from "./geminiAiClient.js";

const MAX_HISTORY_ITEMS = 8;
const MAX_PRODUCTS = 4;
const MAX_REPLY_LENGTH = 700;
const MAX_QUESTION_LENGTH = 90;

const isGeminiShoppingChatEnabled = () => {
  const provider = (
    process.env.AI_CHAT_PROVIDER ||
    process.env.AI_RECOMMENDATION_PROVIDER ||
    ""
  )
    .trim()
    .toLowerCase();

  if (["none", "off", "rules", "local"].includes(provider)) {
    return false;
  }

  if (provider && provider !== "gemini") {
    return false;
  }

  return isGeminiConfigured();
};

const uniqueValues = (items = []) =>
  Array.from(
    new Set(
      items
        .map((item) => toSafeAiString(item, 60))
        .filter(Boolean),
    ),
  );

const toChatHistoryItem = (item) => ({
  role: item?.role === "assistant" ? "assistant" : "user",
  content: toSafeAiString(item?.content, 500),
});

const toChatProductCandidate = (recommendation) => {
  const product = recommendation?.product ?? {};
  const variants = (product.variants ?? []).filter((variant) => variant?.isActive !== false);

  return {
    productId: product._id?.toString(),
    name: toSafeAiString(product.name, 120),
    brand: toSafeAiString(product.brand, 80),
    category: toSafeAiString(product.category?.name, 80),
    price: Number(product.pricing?.regularPrice || product.pricing?.salePrice || 0),
    basePrice: Number(product.pricing?.compareAtPrice || product.pricing?.basePrice || 0),
    availableStock: Number(product.inventorySummary?.available || 0),
    colors: uniqueValues(
      variants.flatMap((variant) => [
        variant?.color?.name,
        variant?.color?.hex,
      ]),
    ).slice(0, 8),
    sizes: uniqueValues(
      variants.flatMap((variant) => [variant?.sizeLabel, variant?.size]),
    ).slice(0, 10),
    shortDescription: toSafeAiString(product.shortDescription || product.description, 220),
    localReason: toSafeAiString(recommendation?.reason, 220),
    localScore: Number(recommendation?.score || 0),
  };
};

const buildPrompt = ({ message, history, recommendationSummary, products }) => `
Bạn là chatbot tư vấn mua hàng của RioShop, một shop thời trang Việt Nam.

Tin nhắn mới của khách:
"${toSafeAiString(message, 500)}"

Lịch sử gần đây:
${JSON.stringify(history, null, 2)}

Tóm tắt tìm kiếm nội bộ:
"${toSafeAiString(recommendationSummary, 500)}"

Sản phẩm hợp lệ từ database:
${JSON.stringify(products, null, 2)}

Quy tắc bắt buộc:
- Chỉ tư vấn dựa trên danh sách sản phẩm hợp lệ ở trên.
- Không bịa sản phẩm, giá, tồn kho, khuyến mãi, chính sách giao hàng hoặc đổi trả.
- Nếu không có sản phẩm phù hợp, hãy hỏi thêm nhu cầu như loại sản phẩm, ngân sách, màu hoặc size.
- Trả lời tiếng Việt tự nhiên, ngắn gọn, tối đa 3 câu.
- Nếu có sản phẩm, nhắc tên 1-3 sản phẩm nổi bật và lý do chọn.
- Trả JSON thuần, không markdown.

Schema JSON:
{
  "reply": "câu trả lời cho khách",
  "suggestedQuestions": ["câu hỏi gợi ý ngắn"]
}
`;

const normalizeChatResult = (payload) => {
  const reply = toSafeAiString(payload?.reply, MAX_REPLY_LENGTH);
  if (!reply) {
    return null;
  }

  return {
    reply,
    suggestedQuestions: Array.isArray(payload?.suggestedQuestions)
      ? payload.suggestedQuestions
          .map((item) => toSafeAiString(item, MAX_QUESTION_LENGTH))
          .filter(Boolean)
          .slice(0, 3)
      : [],
  };
};

export const generateShoppingChatReplyWithGemini = async ({
  message,
  history = [],
  recommendationSummary = "",
  recommendations = [],
}) => {
  if (!isGeminiShoppingChatEnabled()) {
    return null;
  }

  const products = recommendations
    .slice(0, MAX_PRODUCTS)
    .map(toChatProductCandidate)
    .filter((item) => item.productId);

  const safeHistory = history
    .slice(-MAX_HISTORY_ITEMS)
    .map(toChatHistoryItem)
    .filter((item) => item.content);

  const response = await generateGeminiContent({
    contents: buildPrompt({
      message,
      history: safeHistory,
      recommendationSummary,
      products,
    }),
    config: {
      temperature: 0.35,
      topP: 0.9,
      maxOutputTokens: 900,
      responseMimeType: "application/json",
    },
    timeoutMessage: "Gemini shopping chat request timed out",
  });

  return normalizeChatResult(extractGeminiJsonObject(response.text || ""));
};
