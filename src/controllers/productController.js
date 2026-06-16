import {
  asyncHandler,
  sendSuccess,
  sendError,
  getPaginationParams,
} from "../utils/helpers.js";
import slugify from "slugify";
import ExcelJS from "exceljs";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Collection from "../models/Collection.js";
import productService from "../services/productService.js";
import pricingService from "../services/pricingService.js";
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
const MAX_EXPORT_ROWS = 10000;
const XLSX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "application/octet-stream",
]);
const PRODUCT_STATUS_SET = new Set(["draft", "active", "archived", "out_of_stock"]);
const PRODUCT_GENDER_SET = new Set(["men", "women", "unisex", "kids"]);
const PRODUCT_AGE_GROUP_SET = new Set(["adult", "teen", "kids", "baby"]);
const pickLegacyAwarePrice = (canonical, legacy) => {
  const canonicalNumber = Number(canonical);
  const legacyNumber = Number(legacy);

  if (Number.isFinite(canonicalNumber) && canonicalNumber > 0) return canonicalNumber;
  if (Number.isFinite(legacyNumber) && legacyNumber > 0) return legacyNumber;
  if (Number.isFinite(canonicalNumber)) return canonicalNumber;
  if (Number.isFinite(legacyNumber)) return legacyNumber;
  return 0;
};
const getRegularPrice = (pricing = {}) =>
  pickLegacyAwarePrice(pricing.regularPrice, pricing.salePrice);
const getCompareAtPrice = (pricing = {}) =>
  pickLegacyAwarePrice(pricing.compareAtPrice, pricing.basePrice);

const EXPORT_COLUMNS = [
  { key: "productSku", header: "productSku", width: 24 },
  { key: "productName", header: "productName", width: 32 },
  { key: "brand", header: "brand", width: 18 },
  { key: "slug", header: "slug", width: 28 },
  { key: "status", header: "status", width: 12 },
  { key: "categoryId", header: "categoryId", width: 26 },
  { key: "categoryName", header: "categoryName", width: 22 },
  { key: "categorySlug", header: "categorySlug", width: 22 },
  { key: "collectionIds", header: "collectionIds", width: 26 },
  { key: "collectionNames", header: "collectionNames", width: 26 },
  { key: "collectionSlugs", header: "collectionSlugs", width: 26 },
  { key: "regularPrice", header: "regularPrice", width: 14, style: { numFmt: "#,##0" } },
  { key: "compareAtPrice", header: "compareAtPrice", width: 16, style: { numFmt: "#,##0" } },
  { key: "gender", header: "gender", width: 10 },
  { key: "ageGroup", header: "ageGroup", width: 10 },
  { key: "material", header: "material", width: 22 },
  { key: "care", header: "care", width: 22 },
  { key: "shortDescription", header: "shortDescription", width: 32 },
  { key: "description", header: "description", width: 40 },
  { key: "seoTitle", header: "seoTitle", width: 24 },
  { key: "seoDescription", header: "seoDescription", width: 32 },
  { key: "seoKeywords", header: "seoKeywords", width: 24 },
  { key: "variantId", header: "variantId", width: 12 },
  { key: "variantSku", header: "variantSku", width: 24 },
  { key: "variantColorName", header: "variantColorName", width: 16 },
  { key: "variantColorHex", header: "variantColorHex", width: 12 },
  { key: "variantSize", header: "variantSize", width: 10 },
  { key: "variantSizeLabel", header: "variantSizeLabel", width: 14 },
  { key: "variantStock", header: "variantStock", width: 12, style: { numFmt: "#,##0" } },
  { key: "variantAdditionalPrice", header: "variantAdditionalPrice", width: 16, style: { numFmt: "#,##0" } },
  { key: "variantBarcode", header: "variantBarcode", width: 18 },
  { key: "variantImages", header: "variantImages", width: 40 },
  { key: "variantIsActive", header: "variantIsActive", width: 14 },
];

const COLUMN_GUIDE = [
  ["productSku", "B\u1EAFt bu\u1ED9c. M\u00E3 s\u1EA3n ph\u1EA9m cha (g\u1ED9p c\u00E1c d\u00F2ng c\u00F9ng SKU th\u00E0nh 1 s\u1EA3n ph\u1EA9m)."],
  ["productName", "B\u1EAFt bu\u1ED9c. T\u00EAn hi\u1EC3n th\u1ECB c\u1EE7a s\u1EA3n ph\u1EA9m."],
  ["brand", "B\u1EAFt bu\u1ED9c. Th\u01B0\u01A1ng hi\u1EC7u."],
  ["slug", "T\u00F9y ch\u1ECDn. B\u1ECF tr\u1ED1ng \u0111\u1EC3 t\u1EF1 sinh t\u1EEB t\u00EAn + SKU."],
  ["status", "draft | active | archived | out_of_stock (m\u1EB7c \u0111\u1ECBnh draft)."],
  ["categoryId", "B\u1EAFt bu\u1ED9c. C\u00F3 th\u1EC3 \u0111i\u1EC1n ObjectId c\u1EE7a category ho\u1EB7c categorySlug."],
  ["categoryName / categorySlug", "Ch\u1EC9 \u0111\u1EC3 tham kh\u1EA3o khi xu\u1EA5t, h\u1EC7 th\u1ED1ng kh\u00F4ng \u0111\u1ECDc khi nh\u1EADp."],
  ["collectionIds", "T\u00F9y ch\u1ECDn. ObjectId ho\u1EB7c slug, nhi\u1EC1u gi\u00E1 tr\u1ECB c\u00E1ch nhau b\u1EB1ng d\u1EA5u |"],
  ["regularPrice / compareAtPrice", "regularPrice l\u00E0 gi\u00E1 b\u00E1n th\u01B0\u1EDDng ng\u00E0y. compareAtPrice l\u00E0 gi\u00E1 tham chi\u1EBFu/ni\u00EAm y\u1EBFt, t\u00F9y ch\u1ECDn v\u00E0 ph\u1EA3i >= regularPrice n\u1EBFu c\u00F3 nh\u1EADp."],
  ["gender", "men | women | unisex | kids."],
  ["ageGroup", "adult | teen | kids | baby."],
  ["material / care / seoKeywords", "Nhi\u1EC1u gi\u00E1 tr\u1ECB c\u00E1ch nhau b\u1EB1ng d\u1EA5u |"],
  ["variant* (c\u00F9ng productSku)", "M\u1ED7i d\u00F2ng = 1 bi\u1EBFn th\u1EC3. \u0110\u1EC3 nhi\u1EC1u bi\u1EBFn th\u1EC3, l\u1EB7p l\u1EA1i c\u00F9ng productSku."],
  ["variantImages", "Danh s\u00E1ch URL \u1EA3nh, c\u00E1ch nhau b\u1EB1ng d\u1EA5u |"],
  ["variantIsActive", "true / false (m\u1EB7c \u0111\u1ECBnh true)."],
];

const buildProductsWorkbook = ({ rows, sheetName = "Products" }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rioshop";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = EXPORT_COLUMNS.map(({ key, header, width, style }) => ({
    header,
    key,
    width,
    style,
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: "middle" };

  for (const row of rows) {
    sheet.addRow(row);
  }

  const guide = workbook.addWorksheet("H\u01B0\u1EDBng d\u1EABn");
  guide.columns = [
    { header: "C\u1ED9t", key: "column", width: 28 },
    { header: "M\u00F4 t\u1EA3", key: "description", width: 80 },
  ];
  guide.getRow(1).font = { bold: true };
  for (const [column, description] of COLUMN_GUIDE) {
    guide.addRow({ column, description });
  }

  return workbook;
};

const parseProductsWorkbook = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return [];
  }

  const headerRow = sheet.getRow(1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });

  const objects = [];
  for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    if (!row || row.cellCount === 0) {
      continue;
    }

    const obj = { __rowNumber: rowIndex, __normalized: {} };
    let hasValue = false;

    for (let colNumber = 1; colNumber < headers.length; colNumber += 1) {
      const header = headers[colNumber];
      if (!header) {
        continue;
      }
      const cell = row.getCell(colNumber);
      const value = readCellValue(cell);
      if (value !== "") {
        hasValue = true;
      }
      obj[header] = value;
      obj.__normalized[normalizeHeaderKey(header)] = value;
    }

    if (hasValue) {
      objects.push(obj);
    }
  }

  return objects;
};

const readCellValue = (cell) => {
  if (!cell || cell.value === null || cell.value === undefined) {
    return "";
  }

  const { value } = cell;

  if (typeof value === "object") {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value.text === "string") {
      return value.text;
    }
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? "").join("");
    }
    if (typeof value.result !== "undefined") {
      return String(value.result);
    }
    if (typeof value.formula === "string") {
      return "";
    }
    if (typeof value.hyperlink === "string") {
      return value.hyperlink;
    }
  }

  return String(value);
};

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

const normalizeHeaderKey = (value = "") =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_\-]+/g, "");

const getRowValue = (row = {}, aliases = []) => {
  const normalized = row.__normalized ?? {};
  for (const alias of aliases) {
    const aliasKey = normalizeHeaderKey(alias);
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

const resolveCategoryFilter = async (categoryId) => {
  const categories = await Category.find({
    deletedAt: null,
    $or: [{ _id: categoryId }, { "ancestors._id": categoryId }],
  })
    .select("_id")
    .lean();

  const categoryIds = categories.map((item) => item._id);
  return categoryIds.length > 0 ? { $in: categoryIds } : categoryId;
};

const normalizeQueryFilters = async (query = {}) => {
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
    newWithinDays,
  } = query;

  const filters = {};
  if (status && status !== "all") filters.status = status;
  if (category) filters["category._id"] = await resolveCategoryFilter(category);
  if (collection) filters["collections._id"] = collection;
  if (gender) filters.gender = gender;
  if (newWithinDays !== undefined) {
    const safeDays = Math.max(1, Math.min(365, Number(newWithinDays) || 30));
    const cutoff = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
    filters.$and = [
      ...(filters.$and ?? []),
      {
        $expr: {
          $and: [
            { $gte: [{ $ifNull: ["$publishedAt", "$createdAt"] }, cutoff] },
            { $lte: [{ $ifNull: ["$publishedAt", "$createdAt"] }, new Date()] },
          ],
        },
      },
    ];
  }

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
    const priceExpr = {
      $cond: [
        { $gt: [{ $ifNull: ["$pricing.regularPrice", 0] }, 0] },
        "$pricing.regularPrice",
        { $ifNull: ["$pricing.salePrice", 0] },
      ],
    };
    const priceConditions = [];
    if (minPrice !== undefined) {
      priceConditions.push({ $gte: [priceExpr, Number(minPrice)] });
    }
    if (maxPrice !== undefined) {
      priceConditions.push({ $lte: [priceExpr, Number(maxPrice)] });
    }
    if (priceConditions.length > 0) {
      filters.$and = [
        ...(filters.$and ?? []),
        { $expr: priceConditions.length === 1 ? priceConditions[0] : { $and: priceConditions } },
      ];
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
  const filters = await normalizeQueryFilters(req.query);

  let parsedSort = { createdAt: -1 };
  try {
    parsedSort = normalizeSort(req.query.sort);
  } catch {
    return sendError(res, 400, "Invalid sort format");
  }

  const products =
    req.query.ranking === "best_selling"
      ? await productService.getBestSellingProducts(filters, {
          page,
          limit,
        })
      : req.query.newWithinDays !== undefined
        ? await productService.getNewArrivalProducts(filters, {
            page,
            limit,
          })
      : await productService.getAllProducts(filters, {
          page,
          limit,
          sort: parsedSort,
        });

  sendSuccess(res, 200, products, "Products fetched successfully");
});

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const sendXlsxResponse = async (res, workbook, fileName) => {
  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader("Content-Type", XLSX_CONTENT_TYPE);
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.status(200).send(Buffer.from(buffer));
};

export const exportProductsXlsx = asyncHandler(async (req, res) => {
  const filters = await normalizeQueryFilters(req.query);
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
        regularPrice: getRegularPrice(product.pricing),
        compareAtPrice: getCompareAtPrice(product.pricing),
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

  const workbook = buildProductsWorkbook({ rows });
  const fileName = `products-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await sendXlsxResponse(res, workbook, fileName);
});

export const downloadProductsImportTemplateXlsx = asyncHandler(async (_req, res) => {
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
      regularPrice: 199000,
      compareAtPrice: 299000,
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
      regularPrice: 199000,
      compareAtPrice: 299000,
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

  const workbook = buildProductsWorkbook({ rows: templateRows });
  await sendXlsxResponse(res, workbook, "products-import-template.xlsx");
});

export const importProductsXlsx = asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 400, "Excel file is required");
  }

  const fileName = req.file.originalname || "";
  const isXlsxFile =
    XLSX_MIME_TYPES.has(req.file.mimetype) || /\.xlsx$/i.test(fileName);

  if (!isXlsxFile) {
    return sendError(res, 400, "Only .xlsx files are allowed");
  }

  let dataRows = [];
  try {
    dataRows = await parseProductsWorkbook(req.file.buffer);
  } catch (error) {
    return sendError(
      res,
      400,
      `Unable to read Excel file: ${error?.message || "invalid format"}`,
    );
  }

  if (dataRows.length === 0) {
    return sendError(res, 400, "Excel file has no data rows");
  }

  const groupedProducts = new Map();
  const categoryTokens = new Set();
  const collectionTokens = new Set();
  const rowErrors = [];

  for (const row of dataRows) {
    const skuValue = normalizeSkuValue(
      getRowValue(row, ["productSku", "sku"]),
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
        regularPriceRaw: "",
        compareAtPriceRaw: "",
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

    group.name ||= getRowValue(row, ["productName", "name"]);
    group.brand ||= getRowValue(row, ["brand"]);
    group.slug ||= getRowValue(row, ["slug"]);
    group.status ||= getRowValue(row, ["status"]);
    group.categoryToken ||=
      getRowValue(row, ["categoryId", "categorySlug", "category"]);
    group.regularPriceRaw ||= getRowValue(row, ["regularPrice", "salePrice"]);
    group.compareAtPriceRaw ||= getRowValue(row, ["compareAtPrice", "basePrice"]);
    group.gender ||= getRowValue(row, ["gender"]);
    group.ageGroup ||= getRowValue(row, ["ageGroup"]);
    group.materialRaw ||= getRowValue(row, ["material"]);
    group.careRaw ||= getRowValue(row, ["care"]);
    group.shortDescription ||= getRowValue(row, ["shortDescription"]);
    group.description ||= getRowValue(row, ["description"]);
    group.seoTitle ||= getRowValue(row, ["seoTitle"]);
    group.seoDescription ||= getRowValue(row, ["seoDescription"]);
    group.seoKeywordsRaw ||= getRowValue(row, ["seoKeywords"]);

    const collectionRaw = getRowValue(row, ["collectionIds", "collections"]);
    for (const token of splitListValues(collectionRaw)) {
      group.collectionTokens.add(token);
      collectionTokens.add(token);
    }

    if (group.categoryToken) {
      categoryTokens.add(group.categoryToken);
    }

    group.variants.push({
      variantId: getRowValue(row, ["variantId"]),
      sku: normalizeSkuValue(getRowValue(row, ["variantSku"])),
      colorName: getRowValue(row, ["variantColorName"]),
      colorHex: getRowValue(row, ["variantColorHex"]),
      size: getRowValue(row, ["variantSize"]),
      sizeLabel: getRowValue(row, ["variantSizeLabel"]),
      stockRaw: getRowValue(row, ["variantStock"]),
      additionalPriceRaw: getRowValue(row, ["variantAdditionalPrice"]),
      barcode: getRowValue(row, ["variantBarcode"]),
      imagesRaw: getRowValue(row, ["variantImages"]),
      isActiveRaw: getRowValue(row, ["variantIsActive"]),
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

      const regularPrice = toSafeNumber(group.regularPriceRaw, NaN);
      const compareAtPrice = toSafeNumber(group.compareAtPriceRaw, 0);
      if (!Number.isFinite(regularPrice)) {
        throw new Error("Invalid regularPrice");
      }
      if (compareAtPrice > 0 && compareAtPrice < regularPrice) {
        throw new Error("compareAtPrice must be greater than or equal to regularPrice");
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
          regularPrice,
          compareAtPrice,
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

  const MAX_RETURNED_ERRORS = 1000;
  sendSuccess(
    res,
    200,
    {
      created: createdCount,
      updated: updatedCount,
      failed: rowErrors.length,
      totalErrors: rowErrors.length,
      errors: rowErrors.slice(0, MAX_RETURNED_ERRORS),
    },
    "Products Excel imported",
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

  const pricedProduct = await pricingService.attachEffectivePricing(product);
  sendSuccess(res, 200, pricedProduct, "Product fetched successfully");
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

export const getCartRecommendations = asyncHandler(async (req, res) => {
  const recommendations = await productService.getCartRecommendations(
    req.body.productIds,
    req.body.limit,
  );
  sendSuccess(res, 200, recommendations, "Cart recommendations fetched");
});
