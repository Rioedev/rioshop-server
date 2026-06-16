import Product from "../models/Product.js";
import { rerankProductRecommendationsWithGemini } from "./geminiRecommendationProvider.js";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 8;
const CANDIDATE_LIMIT = 80;
const MIN_QUERY_LENGTH = 2;

const STOP_WORDS = new Set([
  "tôi",
  "mình",
  "cần",
  "muốn",
  "tìm",
  "mua",
  "sản",
  "phẩm",
  "hàng",
  "cho",
  "và",
  "với",
  "hoặc",
  "là",
  "dễ",
  "mặc",
  "có",
  "giá",
  "dưới",
  "trên",
  "khoảng",
  "tầm",
  "một",
  "nhưng",
  "các",
  "này",
  "thật",
  "đẹp",
  "tốt",
]);

const CATEGORY_INTENTS = [
  {
    key: "top",
    label: "Áo",
    terms: ["ao"],
    productTerms: ["ao", "shirt", "polo", "tshirt", "khoac", "gile"],
    generic: true,
  },
  {
    key: "shirt",
    label: "Áo sơ mi",
    terms: ["ao so mi", "so mi", "shirt"],
    productTerms: ["ao so mi", "so mi", "shirt"],
  },
  {
    key: "polo",
    label: "Áo polo",
    terms: ["ao polo", "polo"],
    productTerms: ["ao polo", "polo"],
  },
  {
    key: "tshirt",
    label: "Áo thun",
    terms: ["ao thun", "ao phong", "t shirt", "tshirt", "phong nam", "phong nu"],
    productTerms: ["ao thun", "ao phong", "t shirt", "tshirt"],
  },
  {
    key: "jacket",
    label: "Áo khoác",
    terms: ["ao khoac", "khoac", "ao phao", "bomber", "gile", "chong nang"],
    productTerms: ["ao khoac", "khoac", "ao phao", "bomber", "gile", "chong nang"],
  },
  {
    key: "pants",
    label: "Quần",
    terms: ["quan", "quan au", "quan jean", "jeans", "pant", "daily pant"],
    productTerms: ["quan", "quan au", "quan jean", "jeans", "pant"],
  },
  {
    key: "skirt",
    label: "Váy",
    terms: ["vay", "chan vay", "dam", "skirt", "dress"],
    productTerms: ["vay", "chan vay", "dam", "skirt", "dress"],
  },
  {
    key: "sportswear",
    label: "Đồ thể thao",
    terms: ["do the thao", "the thao", "sport", "sportswear", "tap gym", "tap luyen"],
    productTerms: ["do the thao", "the thao", "sport", "sportswear"],
  },
];

const COLOR_INTENTS = [
  { key: "white", label: "Trắng", terms: ["trang", "white"], rawTerms: ["trắng"], hexes: ["#fff", "#ffffff"] },
  {
    key: "black",
    label: "Đen",
    terms: ["den", "black"],
    productTerms: ["den", "black"],
    rawTerms: ["đen"],
    requiresColorPrefix: true,
    hexes: ["#000", "#000000"],
  },
  { key: "blue", label: "Xanh", terms: ["xanh", "xanh duong", "blue"], rawTerms: ["xanh"], hexes: ["#0000ff"] },
  { key: "green", label: "Xanh lá", terms: ["xanh la", "green"], rawTerms: ["xanh lá"], hexes: ["#008000", "#00ff00"] },
  { key: "yellow", label: "Vàng", terms: ["vang", "yellow"], rawTerms: ["vàng"], hexes: ["#ffff00"] },
  {
    key: "red",
    label: "Đỏ",
    terms: ["do", "red"],
    productTerms: ["do", "red"],
    rawTerms: ["đỏ"],
    requiresColorPrefix: true,
    hexes: ["#ff0000"],
  },
  { key: "gray", label: "Xám", terms: ["xam", "ghi", "gray", "grey"], rawTerms: ["xám"], hexes: ["#808080"] },
  {
    key: "beige",
    label: "Be",
    terms: ["be", "kem", "beige", "cream"],
    productTerms: ["be", "kem", "beige", "cream"],
    rawTerms: ["beige"],
    requiresColorPrefix: true,
    hexes: ["#f5f5dc"],
  },
  { key: "brown", label: "Nâu", terms: ["nau", "brown"], rawTerms: ["nâu"], hexes: ["#8b4513"] },
  { key: "pink", label: "Hồng", terms: ["hong", "pink"], rawTerms: ["hồng"], hexes: ["#ffc0cb"] },
];

const USE_CASE_INTENTS = [
  {
    key: "work",
    label: "đi làm",
    terms: ["di lam", "cong so", "van phong", "office", "lich su", "lich su"],
    productTerms: ["so mi", "polo", "quan au", "daily pant", "basic"],
  },
  {
    key: "summer",
    label: "mặc mát",
    terms: ["mua he", "ngay he", "mat", "thoang", "thoang mat", "nong"],
    productTerms: ["coc tay", "cotton", "linen", "nano", "thun", "chong nang"],
  },
  {
    key: "winter",
    label: "giữ ấm",
    terms: ["mua dong", "lanh", "am", "giu am", "phao", "ni"],
    productTerms: ["phao", "ni", "khoac", "bomber", "gile"],
  },
  {
    key: "casual",
    label: "đi chơi",
    terms: ["di choi", "hang ngay", "daily", "casual", "basic"],
    productTerms: ["basic", "daily", "ao thun", "polo", "jeans"],
  },
  {
    key: "sport",
    label: "vận động",
    terms: ["the thao", "tap gym", "tap luyen", "chay bo", "sport"],
    productTerms: ["the thao", "sport", "ni", "co gian"],
  },
];

const GENDER_INTENTS = [
  { value: "unisex", label: "unisex", terms: ["unisex", "ca nam nu", "nam nu"] },
  { value: "men", label: "nam", terms: ["nam", "men", "male", "boy"] },
  { value: "women", label: "nữ", terms: ["nu", "women", "female", "girl"] },
  { value: "kids", label: "trẻ em", terms: ["tre em", "kid", "kids", "be trai", "be gai"] },
];

const uniqueBy = (items, getKey) => {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = getKey(item);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }

  return result;
};

const clampLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsed)));
};

export const normalizeRecommendationText = (value = "") =>
  value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9#.,\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const includesTerm = (normalizedText, term) => {
  const normalizedTerm = normalizeRecommendationText(term);
  if (!normalizedTerm) {
    return false;
  }

  if (!normalizedTerm.includes(" ") && normalizedTerm.length <= 3) {
    const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\s)${escapedTerm}(\\s|$)`, "i").test(normalizedText);
  }

  return normalizedText === normalizedTerm || normalizedText.includes(normalizedTerm);
};

const tokenize = (value = "") =>
  normalizeRecommendationText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
    .slice(0, 24);

const parseNumericAmount = (rawValue = "") => {
  const compact = rawValue.toString().trim().replace(/\s+/g, "");
  if (!compact) {
    return Number.NaN;
  }

  const normalized = /^\d{1,3}([.,]\d{3})+$/.test(compact)
    ? compact.replace(/[.,]/g, "")
    : compact.replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const toMoneyValue = (rawValue, rawUnit = "", inferThousand = false) => {
  const amount = parseNumericAmount(rawValue);
  if (!Number.isFinite(amount)) {
    return null;
  }

  const unit = normalizeRecommendationText(rawUnit);
  if (["k", "nghin", "ngan"].includes(unit)) {
    return Math.round(amount * 1000);
  }
  if (["tr", "trieu", "m"].includes(unit)) {
    return Math.round(amount * 1000000);
  }
  if (inferThousand && amount > 0 && amount < 10000) {
    return Math.round(amount * 1000);
  }

  return Math.round(amount);
};

const extractPriceIntent = (normalizedMessage) => {
  const moneyPattern = "(\\d+(?:[.,]\\d+)?)\\s*(k|nghin|ngan|trieu|tr|m|vnd|d)?";
  const rangeRegex = new RegExp(
    `(?:tu|khoang|tam)\\s+${moneyPattern}\\s*(?:den|toi|-)\\s*${moneyPattern}`,
    "i",
  );
  const rangeMatch = normalizedMessage.match(rangeRegex);
  if (rangeMatch) {
    return {
      minPrice: toMoneyValue(rangeMatch[1], rangeMatch[2], true),
      maxPrice: toMoneyValue(rangeMatch[3], rangeMatch[4], true),
    };
  }

  const maxRegex = new RegExp(
    `(?:duoi|toi da|khong qua|nho hon|<=|<|tam gia|gia tam)\\s*${moneyPattern}`,
    "i",
  );
  const maxMatch = normalizedMessage.match(maxRegex);
  if (maxMatch) {
    return {
      maxPrice: toMoneyValue(maxMatch[1], maxMatch[2], true),
    };
  }

  const minRegex = new RegExp(`(?:tren|tu|hon|>=|>)\\s*${moneyPattern}`, "i");
  const minMatch = normalizedMessage.match(minRegex);
  if (minMatch) {
    return {
      minPrice: toMoneyValue(minMatch[1], minMatch[2], true),
    };
  }

  if (/(gia|duoi|tam|khoang|ngan sach|budget)/.test(normalizedMessage)) {
    const genericMoneyRegex = new RegExp(moneyPattern, "i");
    const genericMatch = normalizedMessage.match(genericMoneyRegex);
    if (genericMatch) {
      return {
        maxPrice: toMoneyValue(genericMatch[1], genericMatch[2], true),
      };
    }
  }

  return {};
};

const extractGender = (normalizedMessage) => {
  const match = GENDER_INTENTS.find((gender) =>
    gender.terms.some((term) => includesTerm(normalizedMessage, term)),
  );

  return match
    ? {
        value: match.value,
        label: match.label,
      }
    : null;
};

const extractListIntents = (normalizedMessage, configs) =>
  configs.filter((config) =>
    config.terms.some((term) => includesTerm(normalizedMessage, term)),
  );

const extractCategoryIntents = (normalizedMessage) => {
  const categories = extractListIntents(normalizedMessage, CATEGORY_INTENTS);
  const specificCategories = categories.filter((category) => !category.generic);

  return specificCategories.length > 0 ? specificCategories : categories;
};

const extractColorIntents = (message, normalizedMessage) => {
  const rawMessage = message.toString().toLowerCase();

  return COLOR_INTENTS.filter((color) => {
    if (color.rawTerms?.some((term) => rawMessage.includes(term))) {
      return true;
    }

    return color.terms.some((term) => {
      if (includesTerm(normalizedMessage, `mau ${term}`) || includesTerm(normalizedMessage, `color ${term}`)) {
        return true;
      }

      return !color.requiresColorPrefix && includesTerm(normalizedMessage, term);
    });
  });
};

const extractSizes = (message = "") => {
  const alphaSizes = Array.from(
    new Set((message.match(/\b(XS|S|M|L|XL|XXL|2XL|3XL)\b/g) ?? []).map((item) => item.toUpperCase())),
  );
  const numericSizes = Array.from(
    new Set((normalizeRecommendationText(message).match(/(?:size|sz)\s*(\d{2})\b/g) ?? []).map((item) => item.replace(/\D/g, ""))),
  );

  return [...alphaSizes, ...numericSizes].slice(0, 8);
};

export const parseRecommendationIntent = (message = "") => {
  const normalizedMessage = normalizeRecommendationText(message);
  const priceIntent = extractPriceIntent(normalizedMessage);
  const gender = extractGender(normalizedMessage);
  const categories = extractCategoryIntents(normalizedMessage);
  const colors = extractColorIntents(message, normalizedMessage);
  const useCases = extractListIntents(normalizedMessage, USE_CASE_INTENTS);

  return {
    raw: message.toString().trim(),
    normalized: normalizedMessage,
    tokens: tokenize(message),
    gender,
    categories,
    colors,
    useCases,
    sizes: extractSizes(message),
    minPrice: priceIntent.minPrice ?? null,
    maxPrice: priceIntent.maxPrice ?? null,
  };
};

const toSearchableProductText = (product = {}) =>
  normalizeRecommendationText(
    [
      product.name,
      product.brand,
      product.shortDescription,
      product.description,
      product.category?.name,
      product.category?.slug,
      ...(product.tags ?? []),
      ...(product.material ?? []),
      ...(product.care ?? []),
      ...(product.collections ?? []).flatMap((collection) => [
        collection?.name,
        collection?.slug,
      ]),
      ...(product.variants ?? []).flatMap((variant) => [
        variant?.color?.name,
        variant?.color?.hex,
        variant?.size,
        variant?.sizeLabel,
      ]),
    ]
      .filter(Boolean)
      .join(" "),
  );

const toCategorySearchableProductText = (product = {}) =>
  normalizeRecommendationText(
    [
      product.name,
      product.category?.name,
      product.category?.slug,
      ...(product.tags ?? []),
      ...(product.collections ?? []).flatMap((collection) => [
        collection?.name,
        collection?.slug,
      ]),
    ]
      .filter(Boolean)
      .join(" "),
  );

const hasActiveVariant = (product, predicate) =>
  (product.variants ?? []).some(
    (variant) => variant?.isActive !== false && predicate(variant),
  );

const productMatchesColor = (product, color) => {
  if (!color) {
    return false;
  }

  return hasActiveVariant(product, (variant) => {
    const colorName = normalizeRecommendationText(variant?.color?.name);
    const colorHex = normalizeRecommendationText(variant?.color?.hex);

    return (
      (color.productTerms ?? color.terms).some((term) => includesTerm(colorName, term)) ||
      color.hexes?.some((hex) => colorHex === normalizeRecommendationText(hex))
    );
  });
};

const productMatchesSize = (product, size) => {
  const expected = size.toString().trim().toUpperCase();
  if (!expected) {
    return false;
  }

  return hasActiveVariant(product, (variant) => {
    const values = [variant?.size, variant?.sizeLabel]
      .filter(Boolean)
      .map((item) => item.toString().trim().toUpperCase());
    return values.includes(expected);
  });
};

const productMatchesGender = (product, gender) => {
  if (!gender?.value) {
    return false;
  }
  if (gender.value === "unisex") {
    return product.gender === "unisex";
  }
  return product.gender === gender.value || product.gender === "unisex";
};

const productMatchesIntentTerms = (searchableText, intentConfig) =>
  intentConfig?.productTerms?.some((term) => includesTerm(searchableText, term)) ||
  intentConfig?.terms?.some((term) => includesTerm(searchableText, term));

const addSignal = (signals, value) => {
  if (value && !signals.includes(value)) {
    signals.push(value);
  }
};

const formatBudget = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

const buildRecommendationReason = (product, intent, signals) => {
  const parts = [];
  const matchedCategory = signals.find((signal) => signal.startsWith("Danh mục "));
  const matchedUseCase = signals.find((signal) => signal.startsWith("Hợp "));
  const matchedColor = signals.find((signal) => signal.startsWith("Màu "));
  const matchedSize = signals.find((signal) => signal.startsWith("Size "));

  if (matchedCategory || intent.gender?.label) {
    parts.push(
      `Phù hợp nhu cầu ${[matchedCategory?.replace("Danh mục ", ""), intent.gender?.label].filter(Boolean).join(" ")}.`,
    );
  }
  if (intent.maxPrice && Number(product.pricing?.regularPrice || product.pricing?.salePrice || 0) <= intent.maxPrice) {
    parts.push(`Giá nằm trong ngân sách ${formatBudget(intent.maxPrice)}.`);
  }
  if (matchedColor) {
    parts.push(`Có ${matchedColor.toLowerCase()}.`);
  }
  if (matchedSize) {
    parts.push(`Có ${matchedSize.toLowerCase()}.`);
  }
  if (matchedUseCase) {
    parts.push(`${matchedUseCase}.`);
  }
  if (Number(product.inventorySummary?.available || 0) > 0) {
    parts.push("Còn hàng để đặt ngay.");
  }

  return parts.slice(0, 3).join(" ") || "Sản phẩm nổi bật gần với nhu cầu bạn nhập.";
};

export const rankRecommendationCandidates = (products = [], intent = {}) => {
  const hasExplicitCategoryIntent = (intent.categories ?? []).length > 0;
  const ranked = products.map((product) => {
    const searchableText = toSearchableProductText(product);
    const categorySearchableText = toCategorySearchableProductText(product);
    const signals = [];
    let categoryMatched = false;
    let score = 20;

    if (productMatchesGender(product, intent.gender)) {
      score += product.gender === intent.gender?.value ? 12 : 6;
      addSignal(signals, `Giới tính ${intent.gender.label}`);
    }

    for (const category of intent.categories ?? []) {
      if (productMatchesIntentTerms(categorySearchableText, category)) {
        categoryMatched = true;
        score += 18;
        addSignal(signals, `Danh mục ${category.label}`);
      }
    }

    for (const useCase of intent.useCases ?? []) {
      if (productMatchesIntentTerms(searchableText, useCase)) {
        score += 10;
        addSignal(signals, `Hợp ${useCase.label}`);
      }
    }

    for (const color of intent.colors ?? []) {
      if (productMatchesColor(product, color)) {
        score += 12;
        addSignal(signals, `Màu ${color.label}`);
      }
    }

    for (const size of intent.sizes ?? []) {
      if (productMatchesSize(product, size)) {
        score += 8;
        addSignal(signals, `Size ${size}`);
      }
    }

    const regularPrice = Number(product.pricing?.regularPrice || product.pricing?.salePrice || 0);
    if (intent.maxPrice && regularPrice > 0 && regularPrice <= intent.maxPrice) {
      score += 14;
      addSignal(signals, `Dưới ${formatBudget(intent.maxPrice)}`);
    } else if (intent.maxPrice && regularPrice > intent.maxPrice) {
      score -= 24;
    }

    if (intent.minPrice && regularPrice >= intent.minPrice) {
      score += 5;
    } else if (intent.minPrice && regularPrice < intent.minPrice) {
      score -= 8;
    }

    const tokenMatches = (intent.tokens ?? []).filter((token) =>
      includesTerm(searchableText, token),
    );
    score += Math.min(tokenMatches.length * 2, 16);

    const compareAtPrice = Number(product.pricing?.compareAtPrice || product.pricing?.basePrice || 0);
    if (compareAtPrice > regularPrice && regularPrice > 0) {
      score += Math.min(((compareAtPrice - regularPrice) / compareAtPrice) * 10, 8);
      addSignal(signals, "Đang giảm giá");
    }

    const available = Number(product.inventorySummary?.available || 0);
    if (available > 0) {
      score += Math.min(available / 10, 6);
    } else {
      score -= 50;
    }

    score += Math.min(Number(product.ratings?.avg || 0) * 2, 10);
    score += Math.min(Math.log10(Number(product.totalSold || 0) + 1) * 4, 8);
    score += Math.min(Math.log10(Number(product.viewCount || 0) + 1) * 2, 5);

    const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));

    return {
      product,
      score: normalizedScore,
      matchedSignals: signals.slice(0, 6),
      reason: buildRecommendationReason(product, intent, signals),
      categoryMatched,
    };
  });

  return ranked
    .filter((item) => Number(item.product.inventorySummary?.available || 0) > 0)
    .filter((item) => !hasExplicitCategoryIntent || item.categoryMatched)
    .sort((a, b) => b.score - a.score || Number(b.product.totalSold || 0) - Number(a.product.totalSold || 0));
};

const toRecommendationItem = (item) => ({
  product: item.product,
  score: item.score,
  reason: item.reason,
  matchedSignals: item.matchedSignals,
});

const applyGeminiRecommendations = async ({
  message,
  intentSummary,
  rankedItems,
  limit,
}) => {
  try {
    const geminiResult = await rerankProductRecommendationsWithGemini({
      message,
      intentSummary,
      rankedItems,
      limit,
    });

    if (!geminiResult?.items?.length) {
      return null;
    }

    const rankedById = new Map(
      rankedItems.map((item) => [item.product?._id?.toString(), item]),
    );
    const selectedIds = new Set();
    const selectedItems = [];

    for (const geminiItem of geminiResult.items) {
      const rankedItem = rankedById.get(geminiItem.productId);
      if (!rankedItem || selectedIds.has(geminiItem.productId)) {
        continue;
      }

      selectedIds.add(geminiItem.productId);
      selectedItems.push({
        ...rankedItem,
        score: geminiItem.score,
        reason: geminiItem.reason || rankedItem.reason,
      });
    }

    if (selectedItems.length < limit) {
      selectedItems.push(
        ...rankedItems.filter((item) => {
          const productId = item.product?._id?.toString();
          return productId && !selectedIds.has(productId);
        }),
      );
    }

    return {
      provider: "gemini",
      summary: geminiResult.summary || intentSummary,
      items: selectedItems.slice(0, limit).map(toRecommendationItem),
    };
  } catch (error) {
    if (process.env.AI_RECOMMENDATION_DEBUG === "true") {
      console.warn("[ai-recommendations] Gemini fallback:", error?.message || error);
    }
    return null;
  }
};

const toRegex = (terms = []) => {
  const escaped = terms
    .map((term) => normalizeRecommendationText(term))
    .filter(Boolean)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  return escaped.length > 0 ? new RegExp(escaped.join("|"), "i") : null;
};

const buildProductQuery = (intent, context = {}, mode = "strict") => {
  const query = {
    deletedAt: null,
    status: "active",
    "inventorySummary.available": { $gt: 0 },
  };

  if (intent.maxPrice || intent.minPrice) {
    const priceExpr = {
      $cond: [
        { $gt: [{ $ifNull: ["$pricing.regularPrice", 0] }, 0] },
        "$pricing.regularPrice",
        { $ifNull: ["$pricing.salePrice", 0] },
      ],
    };
    const priceConditions = [];
    if (intent.maxPrice) {
      priceConditions.push({ $lte: [priceExpr, intent.maxPrice] });
    }
    if (intent.minPrice) {
      priceConditions.push({ $gte: [priceExpr, intent.minPrice] });
    }
    query.$and = [
      ...(query.$and ?? []),
      { $expr: priceConditions.length === 1 ? priceConditions[0] : { $and: priceConditions } },
    ];
  }

  if (context.categoryId) {
    query["category._id"] = context.categoryId;
  }
  if (context.collectionId) {
    query["collections._id"] = context.collectionId;
  }

  if (intent.gender?.value && mode !== "fallback") {
    query.gender =
      intent.gender.value === "unisex"
        ? "unisex"
        : { $in: [intent.gender.value, "unisex"] };
  }

  if (mode !== "fallback") {
    const categoryTerms = (intent.categories ?? []).flatMap((item) => [
      ...item.terms,
      ...(item.productTerms ?? []),
    ]);
    const categoryRegex = toRegex(categoryTerms);
    if (categoryRegex) {
      query.$or = [
        { name: categoryRegex },
        { "category.name": categoryRegex },
        { "category.slug": categoryRegex },
        { tags: categoryRegex },
      ];
    }

  }

  if (mode === "strict") {
    const colorTerms = (intent.colors ?? []).flatMap((item) => [
      ...item.terms,
      ...(item.hexes ?? []),
    ]);
    const colorRegex = toRegex(colorTerms);
    const sizeValues = intent.sizes ?? [];
    if (colorRegex || sizeValues.length > 0) {
      const variantConditions = [{ isActive: { $ne: false } }];

      if (colorRegex) {
        variantConditions.push({
          $or: [
            { "color.name": colorRegex },
            { "color.hex": colorRegex },
          ],
        });
      }

      if (sizeValues.length > 0) {
        variantConditions.push({
          $or: [
            { size: { $in: sizeValues } },
            { sizeLabel: { $in: sizeValues } },
          ],
        });
      }

      query.variants = {
        $elemMatch:
          variantConditions.length === 1
            ? variantConditions[0]
            : { $and: variantConditions },
      };
    }
  }

  return query;
};

const findProducts = async (query, limit) =>
  Product.find(query)
    .sort({
      isFeatured: -1,
      isBestseller: -1,
      totalSold: -1,
      viewCount: -1,
      createdAt: -1,
    })
    .limit(limit)
    .lean();

const buildIntentSummary = (intent) => {
  const parts = [];

  if (intent.categories?.length > 0) {
    parts.push(intent.categories.map((item) => item.label).join(", "));
  }
  if (intent.gender?.label) {
    parts.push(`cho ${intent.gender.label}`);
  }
  if (intent.maxPrice) {
    parts.push(`dưới ${formatBudget(intent.maxPrice)}`);
  }
  if (intent.colors?.length > 0) {
    parts.push(`màu ${intent.colors.map((item) => item.label.toLowerCase()).join(", ")}`);
  }
  if (intent.useCases?.length > 0) {
    parts.push(intent.useCases.map((item) => item.label).join(", "));
  }
  if (intent.sizes?.length > 0) {
    parts.push(`size ${intent.sizes.join(", ")}`);
  }

  return parts.length > 0
    ? `Đã ưu tiên ${parts.join(", ")}.`
    : "Đã ưu tiên sản phẩm còn hàng và gần nhất với nhu cầu bạn nhập.";
};

export class AiRecommendationService {
  async recommendProducts({ message, limit = DEFAULT_LIMIT, context = {} } = {}) {
    const trimmedMessage = message?.toString().trim() ?? "";
    if (trimmedMessage.length < MIN_QUERY_LENGTH) {
      return {
        query: trimmedMessage,
        summary: "Vui lòng nhập nhu cầu rõ hơn để hệ thống gợi ý sản phẩm.",
        intent: parseRecommendationIntent(trimmedMessage),
        items: [],
      };
    }

    const resolvedLimit = clampLimit(limit);
    const intent = parseRecommendationIntent(trimmedMessage);
    const strictProducts = await findProducts(
      buildProductQuery(intent, context, "strict"),
      CANDIDATE_LIMIT,
    );

    let candidates = strictProducts;
    if (candidates.length < resolvedLimit) {
      const relaxedProducts = await findProducts(
        buildProductQuery(intent, context, "relaxed"),
        CANDIDATE_LIMIT,
      );
      candidates = uniqueBy([...candidates, ...relaxedProducts], (item) =>
        item._id?.toString(),
      );
    }

    if (candidates.length < resolvedLimit) {
      const fallbackProducts = await findProducts(
        buildProductQuery(intent, context, "fallback"),
        CANDIDATE_LIMIT,
      );
      candidates = uniqueBy([...candidates, ...fallbackProducts], (item) =>
        item._id?.toString(),
      );
    }

    const rankedItems = rankRecommendationCandidates(candidates, intent);
    const intentSummary = buildIntentSummary(intent);
    const geminiRecommendations = await applyGeminiRecommendations({
      message: trimmedMessage,
      intentSummary,
      rankedItems,
      limit: resolvedLimit,
    });
    const finalItems =
      geminiRecommendations?.items ??
      rankedItems.slice(0, resolvedLimit).map(toRecommendationItem);

    return {
      query: trimmedMessage,
      summary: geminiRecommendations?.summary ?? intentSummary,
      provider: geminiRecommendations?.provider ?? "rules",
      intent: {
        gender: intent.gender,
        categories: intent.categories.map(({ key, label }) => ({ key, label })),
        colors: intent.colors.map(({ key, label }) => ({ key, label })),
        useCases: intent.useCases.map(({ key, label }) => ({ key, label })),
        sizes: intent.sizes,
        minPrice: intent.minPrice,
        maxPrice: intent.maxPrice,
      },
      items: finalItems,
    };
  }
}

export default new AiRecommendationService();
