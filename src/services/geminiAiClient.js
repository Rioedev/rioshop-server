import { GoogleGenAI } from "@google/genai";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 12000;

export const toSafeAiString = (value = "", maxLength = 160) =>
  value
    ?.toString?.()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength) || "";

export const getGeminiApiKey = () =>
  process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || "";

export const getGeminiModelName = () =>
  process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;

export const getGeminiTimeoutMs = () => {
  const parsed = Number(process.env.GEMINI_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
};

export const isGeminiConfigured = () => Boolean(getGeminiApiKey());

export const withGeminiTimeout = async (
  promise,
  timeoutMs = getGeminiTimeoutMs(),
  timeoutMessage = "Gemini request timed out",
) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

export const extractGeminiJsonObject = (rawText = "") => {
  const text = rawText
    .toString()
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(text);
  } catch {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace <= firstBrace) {
      throw new Error("Gemini did not return valid JSON");
    }

    return JSON.parse(text.slice(firstBrace, lastBrace + 1));
  }
};

export const generateGeminiContent = async ({
  contents,
  config = {},
  model = getGeminiModelName(),
  timeoutMs = getGeminiTimeoutMs(),
  timeoutMessage,
}) => {
  const genAI = new GoogleGenAI({ apiKey: getGeminiApiKey() });

  return withGeminiTimeout(
    genAI.models.generateContent({
      model,
      contents,
      config,
    }),
    timeoutMs,
    timeoutMessage,
  );
};
