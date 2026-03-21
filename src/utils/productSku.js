const stripDiacritics = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const normalizeSkuInput = (value = "") =>
  stripDiacritics(value)
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

const compactWord = (value = "", maxLength = 4) => {
  const word = normalizeSkuInput(value).replace(/-/g, "");
  if (!word) return "";
  if (word.length <= maxLength) return word;
  if (maxLength <= 2) return word.slice(0, maxLength);
  return `${word.slice(0, 2)}${word.slice(-(maxLength - 2))}`.slice(0, maxLength);
};

const buildCodeFromText = (value = "", maxLength = 6) => {
  const words = normalizeSkuInput(value)
    .split("-")
    .filter(Boolean);

  if (words.length === 0) return "";
  if (words.length === 1) return compactWord(words[0], maxLength);

  const initials = words.map((word) => word[0]).join("");
  if (initials.length >= 2) {
    return initials.slice(0, maxLength);
  }

  return compactWord(words.join(""), maxLength);
};

export const buildProductSku = ({ name = "", categoryName = "" } = {}) => {
  const categoryCode = buildCodeFromText(categoryName, 4);
  const nameCode = buildCodeFromText(name, 6);

  if (categoryCode && nameCode && nameCode.startsWith(categoryCode)) {
    return nameCode;
  }

  if (categoryCode && nameCode && categoryCode !== nameCode) {
    return `${categoryCode}-${nameCode}`;
  }

  return nameCode || categoryCode || "PRD";
};

export const buildVariantSku = ({
  productSku = "",
  colorName = "",
  size = "",
  index = 0,
} = {}) => {
  const normalizedProductSku = normalizeSkuInput(productSku) || "PRD";
  const colorCode = buildCodeFromText(colorName, 3);
  const sizeCode = buildCodeFromText(size, 4);
  const parts = [normalizedProductSku, colorCode, sizeCode].filter(Boolean);

  if (parts.length === 1) {
    parts.push(`OPT${index + 1}`);
  }

  return parts.join("-");
};
