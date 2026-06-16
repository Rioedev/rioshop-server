import {
  extractGeminiJsonObject,
  generateGeminiContent,
  isGeminiConfigured,
  toSafeAiString,
} from "./geminiAiClient.js";

const MAX_CANDIDATES = 24;
const MAX_REASON_LENGTH = 220;

const toSafeString = toSafeAiString;

const clampScore = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 70;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
};

export const isGeminiRecommendationEnabled = () => {
  const provider = (process.env.AI_RECOMMENDATION_PROVIDER || "").trim().toLowerCase();

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
        .map((item) => toSafeString(item, 60))
        .filter(Boolean),
    ),
  );

const toGeminiProductCandidate = (rankedItem) => {
  const product = rankedItem.product;
  const variants = (product.variants ?? []).filter((variant) => variant?.isActive !== false);

  return {
    productId: product._id?.toString(),
    name: toSafeString(product.name, 120),
    brand: toSafeString(product.brand, 80),
    category: toSafeString(product.category?.name, 80),
    gender: product.gender || "",
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
    tags: uniqueValues(product.tags ?? []).slice(0, 8),
    material: uniqueValues(product.material ?? []).slice(0, 6),
    shortDescription: toSafeString(product.shortDescription || product.description, 220),
    localScore: rankedItem.score,
    localSignals: rankedItem.matchedSignals ?? [],
  };
};

const buildPrompt = ({ message, intentSummary, candidates, limit }) => `
Bạn là trợ lý gợi ý sản phẩm cho một shop thời trang Việt Nam.

Yêu cầu của khách:
"${toSafeString(message, 500)}"

Diễn giải nội bộ:
"${toSafeString(intentSummary, 500)}"

Danh sách sản phẩm ứng viên hợp lệ:
${JSON.stringify(candidates, null, 2)}

Quy tắc bắt buộc:
- Chỉ chọn productId có trong danh sách ứng viên.
- Không bịa sản phẩm, không đổi giá, không tự tạo productId.
- Ưu tiên đúng nhu cầu, còn hàng, đúng ngân sách, đúng màu/size nếu khách có nêu.
- Lý do phải ngắn, tiếng Việt, tối đa 1 câu cho mỗi sản phẩm.
- Trả về JSON thuần, không markdown.

Schema JSON:
{
  "summary": "một câu tóm tắt cách chọn",
  "items": [
    {
      "productId": "id trong danh sách",
      "score": 0,
      "reason": "lý do ngắn"
    }
  ]
}

Trả tối đa ${limit} sản phẩm.
`;

const normalizeGeminiResult = (payload, candidateIds, limit) => {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const normalizedItems = [];
  const usedIds = new Set();

  for (const item of items) {
    const productId = item?.productId?.toString?.().trim();
    if (!productId || !candidateIds.has(productId) || usedIds.has(productId)) {
      continue;
    }

    usedIds.add(productId);
    normalizedItems.push({
      productId,
      score: clampScore(item.score),
      reason: toSafeString(item.reason, MAX_REASON_LENGTH),
    });

    if (normalizedItems.length >= limit) {
      break;
    }
  }

  return {
    summary: toSafeString(payload?.summary, 220),
    items: normalizedItems,
  };
};

export const rerankProductRecommendationsWithGemini = async ({
  message,
  intentSummary,
  rankedItems,
  limit,
}) => {
  if (!isGeminiRecommendationEnabled() || rankedItems.length === 0) {
    return null;
  }

  const candidates = rankedItems
    .slice(0, MAX_CANDIDATES)
    .map(toGeminiProductCandidate)
    .filter((item) => item.productId);
  const candidateIds = new Set(candidates.map((item) => item.productId));

  if (candidateIds.size === 0) {
    return null;
  }

  const response = await generateGeminiContent({
    contents: buildPrompt({ message, intentSummary, candidates, limit }),
    config: {
      temperature: 0.2,
      topP: 0.85,
      maxOutputTokens: 1200,
      responseMimeType: "application/json",
    },
    timeoutMessage: "Gemini recommendation request timed out",
  });
  const payload = extractGeminiJsonObject(response.text || "");
  const normalized = normalizeGeminiResult(payload, candidateIds, limit);

  return normalized.items.length > 0 ? normalized : null;
};
