import {
  asyncHandler,
  sendSuccess,
  sendError,
  getPaginationParams,
} from "../utils/helpers.js";
import slugify from "slugify";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Collection from "../models/Collection.js";
import productService from "../services/productService.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import { normalizeSkuInput } from "../utils/productSku.js";

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const parseCsvValues = (value) =>
  String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const splitListValues = (value) =>
  String(value ?? "")
    .split(/[|,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;
const CSV_BOM = "\uFEFF";
const MAX_EXPORT_ROWS = 10000;
const PRODUCT_STATUS_SET = new Set(["draft", "active", "archived", "out_of_stock"]);
const PRODUCT_GENDER_SET = new Set(["men", "women", "unisex", "kids"]);
const PRODUCT_AGE_GROUP_SET = new Set(["adult", "teen", "kids", "baby"]);
const EXPORT_COLUMNS = [
  "productSku",
  "productName",
  "brand",
  "slug",
  "status",
  "categoryId",
  "categoryName",
  "categorySlug",
  "collectionIds",
  "collectionNames",
  "collectionSlugs",
  "basePrice",
  "salePrice",
  "gender",
  "ageGroup",
  "material",
  "care",
  "shortDescription",
  "description",
  "seoTitle",
  "seoDescription",
  "seoKeywords",
  "variantId",
  "variantSku",
  "variantColorName",
  "variantColorHex",
  "variantSize",
  "variantSizeLabel",
  "variantStock",
  "variantAdditionalPrice",
  "variantBarcode",
  "variantImages",
  "variantIsActive",
];

const VIETNAMESE_CHAR_GROUPS = {
  a: "a\u00e0\u00e1\u1ea1\u1ea3\u00e3\u0103\u1eb1\u1eaf\u1eb7\u1eb3\u1eb5\u00e2\u1ea7\u1ea5\u1ead\u1ea9\u1eab",
  e: "e\u00e8\u00e9\u1eb9\u1ebb\u1ebd\u00ea\u1ec1\u1ebf\u1ec7\u1ec3\u1ec5",
  i: "i\u00ec\u00ed\u1ecb\u1ec9\u0129",
  o: "o\u00f2\u00f3\u1ecd\u1ecf\u00f5\u00f4\u1ed3\u1ed1\u1ed9\u1ed5\u1ed7\u01a1\u1edd\u1edb\u1ee3\u1edf\u1ee1",
  u: "u\u00f9\u00fa\u1ee5\u1ee7\u0169\u01b0\u1eeb\u1ee9\u1ef1\u1eed\u1eef",
  y: "y\u1ef3\u00fd\u1ef5\u1ef7\u1ef9",
  d: "d\u0111",
};

const stripVietnameseDiacritics = (value = "") =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D");
const toVietnameseFlexibleRegex = (value = "") => {
  const normalized = stripVietnameseDiacritics(value).toLowerCase().trim();
  if (!normalized) {
    return null;
  }

  const pattern = normalized
    .split(/\s+/)
    .map((token) =>
      token
        .split("")
        .map((char) => {
          const group = VIETNAMESE_CHAR_GROUPS[char];
          return group ? `[${group}]` : escapeRegex(char);
        })
        .join(""),
    )
    .join("\\s+");

  return new RegExp(pattern, "i");
};

const normalizeCsvHeaderKey = (value = "") =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_\-]+/g, "");

const getCsvCellValue = (row = {}, aliases = []) => {
  const normalized = row.__normalized ?? {};
  for (const alias of aliases) {
    const aliasKey = normalizeCsvHeaderKey(alias);
    const nextValue = normalized[aliasKey];
    if (nextValue !== undefined && nextValue !== null) {
      const trimmed = String(nextValue).trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return "";
};

const parseCsvRows = (text = "") => {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows;
};

const csvRowsToObjects = (rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((item) => String(item ?? "").trim());
  const objects = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const cells = rows[rowIndex] ?? [];
    const obj = { __rowNumber: rowIndex + 1, __normalized: {} };
    let hasValue = false;

    headers.forEach((header, headerIndex) => {
      const value = String(cells[headerIndex] ?? "");
      if (value.trim().length > 0) {
        hasValue = true;
      }

      obj[header] = value;
      obj.__normalized[normalizeCsvHeaderKey(header)] = value;
    });

    if (hasValue) {
      objects.push(obj);
    }
  }

  return objects;
};

const escapeCsvCell = (value) => {
  const normalized = value == null ? "" : String(value);
  if (/["\n\r,]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
};

const serializeCsv = (columns = [], rows = []) => {
  const headerLine = columns.map((column) => escapeCsvCell(column)).join(",");
  const bodyLines = rows.map((row) =>
    columns.map((column) => escapeCsvCell(row[column] ?? "")).join(","),
  );
  return [headerLine, ...bodyLines].join("\n");
};

const toSafeNumber = (value, fallback = NaN) => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return fallback;
  }

  const normalized = raw
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(/,/g, ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toSafeBoolean = (value, fallback = true) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (["1", "true", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n"].includes(normalized)) {
    return false;
  }

  return fallback;
};

const normalizeSkuValue = (value) => normalizeSkuInput(String(value ?? ""));

const normalizeQueryFilters = (query = {}) => {
  const {
    q,
    category,
    collection,
    gender,
    minPrice,
    maxPrice,
    color,
    size,
    status = "active",
  } = query;

  const filters = {};
  if (status && status !== "all") filters.status = status;
  if (category) filters["category._id"] = category;
  if (collection) filters["collections._id"] = collection;
  if (gender) filters.gender = gender;

  const keyword = String(q ?? "").trim();
  if (keyword) {
    const keywordRegex = toVietnameseFlexibleRegex(keyword);
    const keywordFilter = keywordRegex ?? {
      $regex: escapeRegex(keyword),
      $options: "i",
    };

    filters.$or = [
      { name: keywordFilter },
      { brand: keywordFilter },
      { sku: keywordFilter },
      { slug: keywordFilter },
      { "variants.sku": keywordFilter },
    ];
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    filters["pricing.salePrice"] = {};
    if (minPrice !== undefined) {
      filters["pricing.salePrice"].$gte = Number(minPrice);
    }
    if (maxPrice !== undefined) {
      filters["pricing.salePrice"].$lte = Number(maxPrice);
    }
  }

  const colorValues = parseCsvValues(color);
  const sizeValues = parseCsvValues(size);
  if (colorValues.length > 0 || sizeValues.length > 0) {
    const variantFilter = {
      isActive: { $ne: false },
    };

    if (sizeValues.length > 0) {
      variantFilter.size = {
        $in: sizeValues,
      };
    }

    if (colorValues.length > 0) {
      variantFilter.$or = colorValues.map((item) => {
        const escaped = escapeRegex(item);
        const isHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(item);
        return isHex
          ? { "color.hex": { $regex: `^${escaped}$`, $options: "i" } }
          : {
              $or: [
                { "color.name": { $regex: escaped, $options: "i" } },
                { "color.hex": { $regex: `^${escaped}$`, $options: "i" } },
              ],
            };
      });
    }

    filters.variants = { $elemMatch: variantFilter };
  }

  return filters;
};

const normalizeSort = (sortRaw) => {
  let parsedSort = { createdAt: -1 };
  if (sortRaw) {
    parsedSort = JSON.parse(sortRaw);
  }
  return parsedSort;
};

export const getAllProducts = asyncHandler(async (req, res) => {
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);
  const filters = normalizeQueryFilters(req.query);

  let parsedSort = { createdAt: -1 };
  try {
    parsedSort = normalizeSort(req.query.sort);
  } catch {
    return sendError(res, 400, "Invalid sort format");
  }

  const products = await productService.getAllProducts(filters, {
    page,
    limit,
    sort: parsedSort,
  });

  sendSuccess(res, 200, products, "Products fetched successfully");
});

export const exportProductsCsv = asyncHandler(async (req, res) => {
  const filters = normalizeQueryFilters(req.query);
  let parsedSort = { createdAt: -1 };
  try {
    parsedSort = normalizeSort(req.query.sort);
  } catch {
    return sendError(res, 400, "Invalid sort format");
  }

  const products = await Product.find({
    deletedAt: null,
    ...filters,
  })
    .sort(parsedSort)
    .limit(MAX_EXPORT_ROWS)
    .lean();

  const rows = [];

  for (const product of products) {
    const variants =
      Array.isArray(product.variants) && product.variants.length > 0
        ? product.variants
        : [{}];

    for (const variant of variants) {
      rows.push({
        productSku: product.sku ?? "",
        productName: product.name ?? "",
        brand: product.brand ?? "",
        slug: product.slug ?? "",
        status: product.status ?? "draft",
        categoryId: product.category?._id?.toString?.() ?? "",
        categoryName: product.category?.name ?? "",
        categorySlug: product.category?.slug ?? "",
        collectionIds: (product.collections ?? [])
          .map((item) => item?._id?.toString?.())
          .filter(Boolean)
          .join("|"),
        collectionNames: (product.collections ?? [])
          .map((item) => item?.name ?? "")
          .filter(Boolean)
          .join("|"),
        collectionSlugs: (product.collections ?? [])
          .map((item) => item?.slug ?? "")
          .filter(Boolean)
          .join("|"),
        basePrice: product.pricing?.basePrice ?? 0,
        salePrice: product.pricing?.salePrice ?? 0,
        gender: product.gender ?? "",
        ageGroup: product.ageGroup ?? "",
        material: (product.material ?? []).filter(Boolean).join("|"),
        care: (product.care ?? []).filter(Boolean).join("|"),
        shortDescription: product.shortDescription ?? "",
        description: product.description ?? "",
        seoTitle: product.seoMeta?.title ?? "",
        seoDescription: product.seoMeta?.description ?? "",
        seoKeywords: (product.seoMeta?.keywords ?? []).filter(Boolean).join("|"),
        variantId: variant?.variantId ?? "",
        variantSku: variant?.sku ?? "",
        variantColorName: variant?.color?.name ?? "",
        variantColorHex: variant?.color?.hex ?? "",
        variantSize: variant?.size ?? "",
        variantSizeLabel: variant?.sizeLabel ?? "",
        variantStock: Number(variant?.stock ?? 0),
        variantAdditionalPrice: Number(variant?.additionalPrice ?? 0),
        variantBarcode: variant?.barcode ?? "",
        variantImages: (variant?.images ?? []).filter(Boolean).join("|"),
        variantIsActive: variant?.isActive !== false ? "true" : "false",
      });
    }
  }

  const csvContent = serializeCsv(EXPORT_COLUMNS, rows);
  const fileName = `products-export-${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.status(200).send(`${CSV_BOM}${csvContent}`);
});

export const downloadProductsImportTemplateCsv = asyncHandler(async (_req, res) => {
  const templateRows = [
    {
      productSku: "AO-THUN-NAM-001",
      productName: "Ao thun nam basic cotton",
      brand: "Rioshop",
      slug: "ao-thun-nam-basic-cotton",
      status: "active",
      categoryId: "CATEGORY_ID_OR_CATEGORY_SLUG",
      categoryName: "",
      categorySlug: "",
      collectionIds: "COLLECTION_ID_OR_COLLECTION_SLUG",
      collectionNames: "",
      collectionSlugs: "",
      basePrice: 299000,
      salePrice: 199000,
      gender: "men",
      ageGroup: "adult",
      material: "Cotton|Spandex",
      care: "Giat lanh|Khong say",
      shortDescription: "Ao thun nam mac hang ngay",
      description: "Mo ta chi tiet san pham",
      seoTitle: "Ao thun nam basic",
      seoDescription: "Ao thun nam basic cotton dep",
      seoKeywords: "ao thun nam|basic cotton|rioshop",
      variantId: "VAR-1",
      variantSku: "AO-THUN-NAM-001-WHITE-M",
      variantColorName: "Trang",
      variantColorHex: "#FFFFFF",
      variantSize: "M",
      variantSizeLabel: "M",
      variantStock: 20,
      variantAdditionalPrice: 0,
      variantBarcode: "",
      variantImages: "https://example.com/image-1.jpg|https://example.com/image-2.jpg",
      variantIsActive: "true",
    },
    {
      productSku: "AO-THUN-NAM-001",
      productName: "Ao thun nam basic cotton",
      brand: "Rioshop",
      slug: "ao-thun-nam-basic-cotton",
      status: "active",
      categoryId: "CATEGORY_ID_OR_CATEGORY_SLUG",
      categoryName: "",
      categorySlug: "",
      collectionIds: "COLLECTION_ID_OR_COLLECTION_SLUG",
      collectionNames: "",
      collectionSlugs: "",
      basePrice: 299000,
      salePrice: 199000,
      gender: "men",
      ageGroup: "adult",
      material: "Cotton|Spandex",
      care: "Giat lanh|Khong say",
      shortDescription: "Ao thun nam mac hang ngay",
      description: "Mo ta chi tiet san pham",
      seoTitle: "Ao thun nam basic",
      seoDescription: "Ao thun nam basic cotton dep",
      seoKeywords: "ao thun nam|basic cotton|rioshop",
      variantId: "VAR-2",
      variantSku: "AO-THUN-NAM-001-WHITE-L",
      variantColorName: "Trang",
      variantColorHex: "#FFFFFF",
      variantSize: "L",
      variantSizeLabel: "L",
      variantStock: 15,
      variantAdditionalPrice: 0,
      variantBarcode: "",
      variantImages: "https://example.com/image-1.jpg|https://example.com/image-2.jpg",
      variantIsActive: "true",
    },
  ];

  const csvContent = serializeCsv(EXPORT_COLUMNS, templateRows);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="products-import-template.csv"',
  );
  res.status(200).send(`${CSV_BOM}${csvContent}`);
});

export const importProductsCsv = asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 400, "CSV file is required");
  }

  const fileName = req.file.originalname || "";
  const isCsvFile =
    req.file.mimetype?.includes("csv") ||
    req.file.mimetype?.includes("excel") ||
    /\.csv$/i.test(fileName);

  if (!isCsvFile) {
    return sendError(res, 400, "Only CSV files are allowed");
  }

  const textContent = req.file.buffer.toString("utf8").replace(/^\uFEFF/, "");
  const csvRows = parseCsvRows(textContent);
  const dataRows = csvRowsToObjects(csvRows);

  if (dataRows.length === 0) {
    return sendError(res, 400, "CSV file has no data rows");
  }

  const groupedProducts = new Map();
  const categoryTokens = new Set();
  const collectionTokens = new Set();
  const rowErrors = [];

  for (const row of dataRows) {
    const skuValue = normalizeSkuValue(
      getCsvCellValue(row, ["productSku", "sku"]),
    );
    if (!skuValue) {
      rowErrors.push({
        row: row.__rowNumber,
        message: "Missing product SKU",
      });
      continue;
    }

    const existingGroup = groupedProducts.get(skuValue);
    const group =
      existingGroup ||
      {
        sku: skuValue,
        name: "",
        brand: "",
        slug: "",
        status: "",
        categoryToken: "",
        collectionTokens: new Set(),
        basePriceRaw: "",
        salePriceRaw: "",
        gender: "",
        ageGroup: "",
        materialRaw: "",
        careRaw: "",
        shortDescription: "",
        description: "",
        seoTitle: "",
        seoDescription: "",
        seoKeywordsRaw: "",
        variants: [],
      };

    group.name ||= getCsvCellValue(row, ["productName", "name"]);
    group.brand ||= getCsvCellValue(row, ["brand"]);
    group.slug ||= getCsvCellValue(row, ["slug"]);
    group.status ||= getCsvCellValue(row, ["status"]);
    group.categoryToken ||=
      getCsvCellValue(row, ["categoryId", "categorySlug", "category"]);
    group.basePriceRaw ||= getCsvCellValue(row, ["basePrice"]);
    group.salePriceRaw ||= getCsvCellValue(row, ["salePrice"]);
    group.gender ||= getCsvCellValue(row, ["gender"]);
    group.ageGroup ||= getCsvCellValue(row, ["ageGroup"]);
    group.materialRaw ||= getCsvCellValue(row, ["material"]);
    group.careRaw ||= getCsvCellValue(row, ["care"]);
    group.shortDescription ||= getCsvCellValue(row, ["shortDescription"]);
    group.description ||= getCsvCellValue(row, ["description"]);
    group.seoTitle ||= getCsvCellValue(row, ["seoTitle"]);
    group.seoDescription ||= getCsvCellValue(row, ["seoDescription"]);
    group.seoKeywordsRaw ||= getCsvCellValue(row, ["seoKeywords"]);

    const collectionRaw = getCsvCellValue(row, ["collectionIds", "collections"]);
    for (const token of splitListValues(collectionRaw)) {
      group.collectionTokens.add(token);
      collectionTokens.add(token);
    }

    if (group.categoryToken) {
      categoryTokens.add(group.categoryToken);
    }

    group.variants.push({
      variantId: getCsvCellValue(row, ["variantId"]),
      sku: normalizeSkuValue(getCsvCellValue(row, ["variantSku"])),
      colorName: getCsvCellValue(row, ["variantColorName"]),
      colorHex: getCsvCellValue(row, ["variantColorHex"]),
      size: getCsvCellValue(row, ["variantSize"]),
      sizeLabel: getCsvCellValue(row, ["variantSizeLabel"]),
      stockRaw: getCsvCellValue(row, ["variantStock"]),
      additionalPriceRaw: getCsvCellValue(row, ["variantAdditionalPrice"]),
      barcode: getCsvCellValue(row, ["variantBarcode"]),
      imagesRaw: getCsvCellValue(row, ["variantImages"]),
      isActiveRaw: getCsvCellValue(row, ["variantIsActive"]),
    });

    groupedProducts.set(skuValue, group);
  }

  const categoryIdTokens = [];
  const categorySlugTokens = [];
  for (const token of categoryTokens) {
    if (OBJECT_ID_REGEX.test(token)) {
      categoryIdTokens.push(token);
    } else {
      categorySlugTokens.push(token);
    }
  }

  const collectionIdTokens = [];
  const collectionSlugTokens = [];
  for (const token of collectionTokens) {
    if (OBJECT_ID_REGEX.test(token)) {
      collectionIdTokens.push(token);
    } else {
      collectionSlugTokens.push(token);
    }
  }

  const categoryFilters = [];
  if (categoryIdTokens.length > 0) {
    categoryFilters.push({ _id: { $in: categoryIdTokens } });
  }
  if (categorySlugTokens.length > 0) {
    categoryFilters.push({ slug: { $in: categorySlugTokens } });
  }

  const categories =
    categoryFilters.length > 0
      ? await Category.find({
          deletedAt: null,
          $or: categoryFilters,
        })
          .select("_id name slug ancestors")
          .lean()
      : [];

  const categoriesById = new Map();
  const categoriesBySlug = new Map();
  for (const category of categories) {
    categoriesById.set(category._id.toString(), category);
    categoriesBySlug.set((category.slug || "").toString().trim(), category);
  }

  const collectionFilters = [];
  if (collectionIdTokens.length > 0) {
    collectionFilters.push({ _id: { $in: collectionIdTokens } });
  }
  if (collectionSlugTokens.length > 0) {
    collectionFilters.push({ slug: { $in: collectionSlugTokens } });
  }

  const collections =
    collectionFilters.length > 0
      ? await Collection.find({
          deletedAt: null,
          $or: collectionFilters,
        })
          .select("_id name slug image")
          .lean()
      : [];

  const collectionsById = new Map();
  const collectionsBySlug = new Map();
  for (const collection of collections) {
    collectionsById.set(collection._id.toString(), collection);
    collectionsBySlug.set((collection.slug || "").toString().trim(), collection);
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const [sku, group] of groupedProducts.entries()) {
    try {
      const name = (group.name || "").trim();
      const brand = (group.brand || "").trim();
      if (!name) {
        throw new Error("Missing product name");
      }
      if (!brand) {
        throw new Error("Missing brand");
      }

      const categoryToken = (group.categoryToken || "").trim();
      if (!categoryToken) {
        throw new Error("Missing categoryId or categorySlug");
      }

      const category =
        categoriesById.get(categoryToken) || categoriesBySlug.get(categoryToken);
      if (!category) {
        throw new Error(`Category not found: ${categoryToken}`);
      }

      const basePrice = toSafeNumber(group.basePriceRaw, NaN);
      const salePrice = toSafeNumber(group.salePriceRaw, NaN);
      if (!Number.isFinite(basePrice) || !Number.isFinite(salePrice)) {
        throw new Error("Invalid basePrice or salePrice");
      }
      if (salePrice > basePrice) {
        throw new Error("salePrice must be less than or equal to basePrice");
      }

      const collectionRefs = [];
      for (const token of group.collectionTokens) {
        const ref =
          collectionsById.get(token) || collectionsBySlug.get(token);
        if (!ref) {
          throw new Error(`Collection not found: ${token}`);
        }
        collectionRefs.push({
          _id: ref._id.toString(),
          name: ref.name,
          slug: ref.slug,
          image: ref.image,
        });
      }

      const variants = (group.variants ?? []).map((variant, variantIndex) => {
        const size = (variant.size || "").trim() || "M";
        const stock = Math.max(0, toSafeNumber(variant.stockRaw, 0));
        const additionalPrice = Math.max(0, toSafeNumber(variant.additionalPriceRaw, 0));
        const colorName = (variant.colorName || "").trim();
        const colorHex = (variant.colorHex || "").trim();
        const images = splitListValues(variant.imagesRaw);

        return {
          variantId: (variant.variantId || "").trim() || `VAR-${variantIndex + 1}`,
          sku: (variant.sku || "").trim(),
          size,
          sizeLabel: (variant.sizeLabel || "").trim() || size,
          stock,
          additionalPrice,
          barcode: (variant.barcode || "").trim(),
          images,
          isActive: toSafeBoolean(variant.isActiveRaw, true),
          color:
            colorName || colorHex
              ? {
                  name: colorName,
                  hex: colorHex,
                }
              : undefined,
        };
      });

      if (variants.length === 0) {
        variants.push({
          variantId: "VAR-1",
          sku: "",
          size: "M",
          sizeLabel: "M",
          stock: 0,
          additionalPrice: 0,
          barcode: "",
          images: [],
          isActive: true,
        });
      }

      const payload = {
        sku,
        slug:
          (group.slug || "").trim() ||
          slugify(`${name}-${sku}`, { lower: true, strict: true, trim: true }) ||
          sku.toLowerCase(),
        name,
        brand,
        category: {
          _id: category._id.toString(),
          name: category.name,
          slug: category.slug || "",
          ancestors: Array.isArray(category.ancestors) ? category.ancestors : [],
        },
        collections: collectionRefs,
        pricing: {
          basePrice,
          salePrice,
          currency: "VND",
        },
        status: PRODUCT_STATUS_SET.has(group.status) ? group.status : "draft",
        gender: PRODUCT_GENDER_SET.has(group.gender) ? group.gender : undefined,
        ageGroup: PRODUCT_AGE_GROUP_SET.has(group.ageGroup) ? group.ageGroup : undefined,
        material: splitListValues(group.materialRaw),
        care: splitListValues(group.careRaw),
        shortDescription: group.shortDescription || "",
        description: group.description || "",
        seoMeta: {
          title: group.seoTitle || "",
          description: group.seoDescription || "",
          keywords: splitListValues(group.seoKeywordsRaw),
        },
        variants,
      };

      const existingProduct = await Product.findOne({
        sku,
        deletedAt: null,
      })
        .select("_id")
        .lean();

      if (existingProduct?._id) {
        await productService.updateProduct(existingProduct._id, payload);
        updatedCount += 1;
      } else {
        await productService.createProduct(payload);
        createdCount += 1;
      }
    } catch (error) {
      rowErrors.push({
        sku,
        message: error?.message || "Failed to import product",
      });
    }
  }

  sendSuccess(
    res,
    200,
    {
      created: createdCount,
      updated: updatedCount,
      failed: rowErrors.length,
      errors: rowErrors.slice(0, 100),
    },
    "Products CSV imported",
  );
});

export const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await productService.getProductBySlug(req.params.slug);

  if (!product) {
    return sendError(res, 404, "Product not found");
  }

  // Increment view count asynchronously
  await productService.updateProduct(product._id, {
    viewCount: (product.viewCount || 0) + 1,
  });

  sendSuccess(res, 200, product, "Product fetched successfully");
});

export const searchProducts = asyncHandler(async (req, res) => {
  const { q, page, limit, status = "active" } = req.query;

  if (!q || q.trim().length === 0) {
    return sendError(res, 400, "Search query is required");
  }

  const { page: pageNum, limit: limitNum } = getPaginationParams(page, limit);
  const filters = {};
  if (status && status !== "all") filters.status = status;

  const keyword = q.trim();
  const keywordRegex = toVietnameseFlexibleRegex(keyword);
  const products = await productService.searchProducts(
    keywordRegex ?? keyword,
    filters,
    {
      page: pageNum,
      limit: limitNum,
    },
  );

  sendSuccess(res, 200, products, "Products searched successfully");
});

export const createProduct = asyncHandler(async (req, res) => {
  // Typically called by admin only
  const product = await productService.createProduct(req.body);
  sendSuccess(res, 201, product, "Product created successfully");
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.body);

  if (!product) {
    return sendError(res, 404, "Product not found");
  }

  sendSuccess(res, 200, product, "Product updated successfully");
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await productService.deleteProduct(req.params.id);

  if (!product) {
    return sendError(res, 404, "Product not found");
  }

  sendSuccess(res, 200, product, "Product deleted successfully");
});

export const uploadProductImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 400, "File image is required");
  }

  if (!req.file.mimetype?.startsWith("image/")) {
    return sendError(res, 400, "Only image files are allowed");
  }

  const base64 = req.file.buffer.toString("base64");
  const dataUri = `data:${req.file.mimetype};base64,${base64}`;
  const uploadResult = await uploadToCloudinary(dataUri, "rioshop/products");

  sendSuccess(
    res,
    200,
    {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    },
    "Image uploaded successfully",
  );
});

export const getRelatedProducts = asyncHandler(async (req, res) => {
  const relatedProducts = await productService.getRelatedProducts(
    req.params.id,
    6,
  );
  sendSuccess(res, 200, relatedProducts, "Related products fetched");
});
