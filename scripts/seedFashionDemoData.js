import dotenv from "dotenv";
import mongoose from "mongoose";
import slugify from "slugify";

import connectDB from "../src/config/database.js";
import BrandConfig from "../src/models/BrandConfig.js";
import Category from "../src/models/Category.js";
import FlashSale from "../src/models/FlashSale.js";
import Product from "../src/models/Product.js";

dotenv.config();

const BRAND_KEY = "rioshop-default";
const CATALOG_SIZE_PER_CATEGORY = 12;
const now = new Date();

const CATEGORY_BLUEPRINTS = [
  {
    code: "TSM",
    name: "Ao thun nam",
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80",
    minPrice: 159000,
    maxPrice: 329000,
    gender: "men",
    ageGroup: "adult",
    productLabel: "Ao thun nam",
    collections: ["Essential", "Compact", "Daily", "Active", "Airy", "Core"],
    materials: ["Cotton Compact", "Cotton Air", "Cotton USA", "Cotton Poly"],
    fits: ["Regular Fit", "Slim Fit", "Relaxed Fit"],
    colors: [
      { name: "Trang", hex: "#ffffff" },
      { name: "Den", hex: "#111827" },
      { name: "Xanh navy", hex: "#1e3a8a" },
      { name: "Xam dam", hex: "#4b5563" },
    ],
    sizes: ["S", "M", "L", "XL", "2XL"],
  },
  {
    code: "PLM",
    name: "Ao polo nam",
    image: "https://images.unsplash.com/photo-1622470953794-aa9c70b0fb9d?auto=format&fit=crop&w=1200&q=80",
    minPrice: 239000,
    maxPrice: 429000,
    gender: "men",
    ageGroup: "adult",
    productLabel: "Ao polo nam",
    collections: ["Prime", "CoolTouch", "Pique Air", "Business Casual", "Daily"],
    materials: ["Cotton Pique", "Cotton Spandex", "Cafe Pique", "Poly Pique"],
    fits: ["Regular Fit", "Slim Fit", "Relaxed Fit"],
    colors: [
      { name: "Trang", hex: "#ffffff" },
      { name: "Den", hex: "#111827" },
      { name: "Xanh reu", hex: "#475569" },
      { name: "Xanh navy", hex: "#243b53" },
    ],
    sizes: ["S", "M", "L", "XL", "2XL"],
  },
  {
    code: "SMM",
    name: "Ao so mi nam",
    image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=1200&q=80",
    minPrice: 299000,
    maxPrice: 559000,
    gender: "men",
    ageGroup: "adult",
    productLabel: "Ao so mi nam",
    collections: ["Oxford", "Daily Office", "Easy Iron", "Premium Weave", "Summer Light"],
    materials: ["Cotton Oxford", "Cotton Bamboo", "Cotton Poplin", "Linen Blend"],
    fits: ["Regular Fit", "Slim Fit"],
    colors: [
      { name: "Trang", hex: "#ffffff" },
      { name: "Xanh nhat", hex: "#bfdbfe" },
      { name: "Kem", hex: "#f5f5dc" },
      { name: "Xam", hex: "#9ca3af" },
    ],
    sizes: ["M", "L", "XL", "2XL"],
  },
  {
    code: "JNM",
    name: "Quan jean nam",
    image: "https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=1200&q=80",
    minPrice: 399000,
    maxPrice: 699000,
    gender: "men",
    ageGroup: "adult",
    productLabel: "Quan jean nam",
    collections: ["Basic Denim", "Flex Denim", "Urban", "Easy Move", "Street"],
    materials: ["Denim Cotton", "Denim Stretch", "Cotton Twill"],
    fits: ["Slim Fit", "Straight Fit", "Relaxed Fit"],
    colors: [
      { name: "Xanh denim", hex: "#1d4ed8" },
      { name: "Xanh dam", hex: "#1e293b" },
      { name: "Den", hex: "#111827" },
    ],
    sizes: ["29", "30", "31", "32", "33", "34"],
  },
  {
    code: "TSW",
    name: "Ao thun nu",
    image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80",
    minPrice: 149000,
    maxPrice: 299000,
    gender: "women",
    ageGroup: "adult",
    productLabel: "Ao thun nu",
    collections: ["Soft Daily", "Airy Tee", "Minimal", "Cotton Touch", "Easy Wear"],
    materials: ["Cotton Compact", "Cotton Air", "Modal Blend", "Cotton Spandex"],
    fits: ["Regular Fit", "Slim Fit", "Relaxed Fit"],
    colors: [
      { name: "Trang", hex: "#ffffff" },
      { name: "Hong", hex: "#f9a8d4" },
      { name: "Xanh pastel", hex: "#93c5fd" },
      { name: "Den", hex: "#111827" },
    ],
    sizes: ["S", "M", "L", "XL"],
  },
  {
    code: "DRW",
    name: "Dam nu",
    image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=80",
    minPrice: 349000,
    maxPrice: 699000,
    gender: "women",
    ageGroup: "adult",
    productLabel: "Dam nu",
    collections: ["Midi", "Grace", "Summer Breeze", "Office Chic", "Minimal"],
    materials: ["Rayon Blend", "Cotton Linen", "Poly Crepe", "Modal Cotton"],
    fits: ["Regular Fit", "A-Line", "Relaxed Fit"],
    colors: [
      { name: "Be", hex: "#d6c6b8" },
      { name: "Den", hex: "#111827" },
      { name: "Xanh navy", hex: "#1e3a8a" },
      { name: "Hong pastel", hex: "#fbcfe8" },
    ],
    sizes: ["S", "M", "L", "XL"],
  },
  {
    code: "SKW",
    name: "Chan vay nu",
    image: "https://images.unsplash.com/photo-1551232864-3f0890e580d9?auto=format&fit=crop&w=1200&q=80",
    minPrice: 279000,
    maxPrice: 499000,
    gender: "women",
    ageGroup: "adult",
    productLabel: "Chan vay nu",
    collections: ["Pleated", "Urban", "Basic", "Twill", "Easy Match"],
    materials: ["Poly Twill", "Cotton Twill", "Denim Light"],
    fits: ["A-Line", "Regular Fit"],
    colors: [
      { name: "Den", hex: "#111827" },
      { name: "Be", hex: "#d6c6b8" },
      { name: "Nau", hex: "#7c5a43" },
      { name: "Xam", hex: "#9ca3af" },
    ],
    sizes: ["S", "M", "L", "XL"],
  },
  {
    code: "JKW",
    name: "Ao khoac nu",
    image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=80",
    minPrice: 399000,
    maxPrice: 899000,
    gender: "women",
    ageGroup: "adult",
    productLabel: "Ao khoac nu",
    collections: ["Wind Light", "UV Shield", "Daily Jacket", "Soft Shell", "Cardigan"],
    materials: ["Poly Light", "Nylon UV", "French Terry", "Cotton Poly"],
    fits: ["Regular Fit", "Relaxed Fit"],
    colors: [
      { name: "Trang", hex: "#ffffff" },
      { name: "Kem", hex: "#f3ead8" },
      { name: "Xanh reu", hex: "#64748b" },
      { name: "Den", hex: "#111827" },
    ],
    sizes: ["S", "M", "L", "XL"],
  },
  {
    code: "TSK",
    name: "Ao thun tre em",
    image: "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=1200&q=80",
    minPrice: 119000,
    maxPrice: 239000,
    gender: "kids",
    ageGroup: "kids",
    productLabel: "Ao thun tre em",
    collections: ["Happy Cotton", "Daily Kid", "Play Time", "Soft Touch", "Active Kid"],
    materials: ["Cotton Compact", "Cotton Air", "Cotton Spandex"],
    fits: ["Regular Fit", "Relaxed Fit"],
    colors: [
      { name: "Vang", hex: "#fde68a" },
      { name: "Xanh da troi", hex: "#60a5fa" },
      { name: "Hong", hex: "#f9a8d4" },
      { name: "Trang", hex: "#ffffff" },
    ],
    sizes: ["90", "100", "110", "120", "130", "140"],
  },
  {
    code: "SHK",
    name: "Quan short tre em",
    image: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=1200&q=80",
    minPrice: 139000,
    maxPrice: 269000,
    gender: "kids",
    ageGroup: "kids",
    productLabel: "Quan short tre em",
    collections: ["Active Kid", "Summer Play", "Basic Short", "Move Free"],
    materials: ["Cotton Twill", "Poly Light", "French Terry"],
    fits: ["Regular Fit", "Relaxed Fit"],
    colors: [
      { name: "Be", hex: "#d6c6b8" },
      { name: "Xanh navy", hex: "#1e3a8a" },
      { name: "Den", hex: "#111827" },
    ],
    sizes: ["90", "100", "110", "120", "130", "140"],
  },
  {
    code: "ACC",
    name: "Phu kien",
    image: "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80",
    minPrice: 79000,
    maxPrice: 259000,
    gender: "unisex",
    ageGroup: "adult",
    productLabel: "Phu kien",
    collections: ["Basic", "Everyday", "Travel", "Sport", "Minimal"],
    materials: ["Canvas", "Cotton", "Poly", "Nylon"],
    fits: ["Regular Fit"],
    colors: [
      { name: "Den", hex: "#111827" },
      { name: "Xam", hex: "#6b7280" },
      { name: "Be", hex: "#d6c6b8" },
    ],
    sizes: ["F"],
  },
];

const PRODUCT_ACCENTS = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
];

const BENEFITS = [
  "be mat mem va mac thoang",
  "giu form on dinh sau nhieu lan giat",
  "de phoi do moi ngay",
  "tham hut mo hoi tot",
  "co do co gian nhe de van dong",
  "phu hop di lam, di choi va du lich",
];

const CARE_GUIDE = [
  "Giat may che do nhe duoi 30 do C",
  "Khong dung thuoc tay",
  "Phan loai mau truoc khi giat",
  "Phơi noi thoang mat, tranh nang gat",
];

const roundToThousand = (value) => Math.round(value / 1000) * 1000;

const deterministic = (seed) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const rangeValue = (seed, min, max) => {
  const ratio = deterministic(seed);
  return min + (max - min) * ratio;
};

const toSlug = (value) =>
  slugify(value, {
    lower: true,
    strict: true,
    locale: "vi",
    trim: true,
  });

const pickRotation = (items, start, count) =>
  Array.from({ length: count }).map((_, index) => items[(start + index) % items.length]);

const buildSizeChartRows = (sizes) =>
  sizes.slice(0, 5).map((size, index) => ({
    size,
    chest: 46 + index * 2,
    length: 64 + index * 1.5,
    shoulder: 40 + index * 1.2,
  }));

const buildCategoryDescription = (category) =>
  `${category.name} theo phong cach toi gian, de mac va de phoi trong nhieu tinh huong nhu di lam, di choi hoac du lich ngan ngay.`;

const upsertCategories = async () => {
  const operations = CATEGORY_BLUEPRINTS.map((item, index) => {
    const slug = toSlug(item.name);

    return {
      updateOne: {
        filter: { slug, deletedAt: null },
        update: {
          $set: {
            name: item.name,
            slug,
            description: buildCategoryDescription(item),
            parentId: null,
            ancestors: [],
            level: 0,
            path: slug,
            image: item.image,
            icon: "",
            position: index + 1,
            isActive: true,
            deletedAt: null,
            seoMeta: {
              title: `${item.name} | RioShop`,
              description: buildCategoryDescription(item),
              keywords: [item.name, item.productLabel, "thoi trang co ban", "RioShop"],
            },
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        upsert: true,
      },
    };
  });

  await Category.bulkWrite(operations, { ordered: false });

  const categories = await Category.find({
    slug: { $in: CATEGORY_BLUEPRINTS.map((item) => toSlug(item.name)) },
    deletedAt: null,
  });

  const bySlug = new Map(categories.map((item) => [item.slug, item]));

  return CATEGORY_BLUEPRINTS.map((item) => {
    const slug = toSlug(item.name);
    const category = bySlug.get(slug);

    if (!category) {
      throw new Error(`Category missing after upsert: ${item.name}`);
    }

    return {
      ...item,
      _id: category._id,
      slug: category.slug,
    };
  });
};

const buildProductPayload = (category, categoryIndex, productIndex) => {
  const accent = PRODUCT_ACCENTS[productIndex % PRODUCT_ACCENTS.length];
  const collection = category.collections[(categoryIndex + productIndex) % category.collections.length];
  const fit = category.fits[(categoryIndex * 2 + productIndex) % category.fits.length];
  const material = category.materials[(categoryIndex + productIndex * 3) % category.materials.length];
  const benefit = BENEFITS[(categoryIndex * 3 + productIndex) % BENEFITS.length];
  const colorSet = pickRotation(category.colors, productIndex % category.colors.length, Math.min(3, category.colors.length));

  const name = `${category.productLabel} ${collection} ${accent}`;
  const slug = toSlug(`${name} ${category.code}`);
  const sku = `RIO-${category.code}-${String(productIndex + 1).padStart(3, "0")}`;

  const basePriceRaw = rangeValue((categoryIndex + 1) * 100 + productIndex + 1, category.minPrice, category.maxPrice);
  const basePrice = roundToThousand(basePriceRaw);
  const discountRatio = [1, 0.95, 0.9, 0.88, 0.85][(categoryIndex + productIndex) % 5];
  const salePrice = roundToThousand(basePrice * discountRatio);

  const sold = Math.floor(rangeValue((categoryIndex + 1) * 1000 + productIndex, 60, 4200));
  const ratingAvg = Number((4.3 + deterministic((categoryIndex + 3) * 2000 + productIndex) * 0.6).toFixed(1));
  const ratingCount = Math.floor(rangeValue((categoryIndex + 5) * 1300 + productIndex, 12, 1500));
  const createdAt = new Date(
    now.getTime() - Math.floor(rangeValue((categoryIndex + 9) * 1500 + productIndex, 1, 220)) * 86400000,
  );

  const variants = colorSet.flatMap((color, colorIndex) =>
    category.sizes.map((size, sizeIndex) => ({
      variantId: `${sku}-${toSlug(color.name)}-${size}`,
      sku: `${sku}-${String(colorIndex + 1).padStart(2, "0")}-${size}`,
      color: {
        name: color.name,
        hex: color.hex,
        imageUrl: `https://picsum.photos/seed/${slug}-${toSlug(color.name)}-swatch/180/220`,
      },
      size,
      sizeLabel: size,
      additionalPrice: sizeIndex >= 3 ? 10000 : 0,
      barcode: `${category.code}${productIndex + 1}${colorIndex + 1}${sizeIndex + 1}`,
      images: [
        `https://picsum.photos/seed/${slug}-${toSlug(color.name)}-1/1200/1500`,
        `https://picsum.photos/seed/${slug}-${toSlug(color.name)}-2/1200/1500`,
      ],
      isActive: true,
      position: colorIndex * 10 + sizeIndex + 1,
    })),
  );

  const media = colorSet.flatMap((color, colorIndex) => [
    {
      url: `https://picsum.photos/seed/${slug}-${toSlug(color.name)}-cover/1200/1500`,
      type: "image",
      altText: `${name} mau ${color.name}`,
      colorRef: color.name,
      isPrimary: colorIndex === 0,
      position: colorIndex * 2 + 1,
    },
    {
      url: `https://picsum.photos/seed/${slug}-${toSlug(color.name)}-detail/1200/1500`,
      type: "image",
      altText: `${name} chi tiet mau ${color.name}`,
      colorRef: color.name,
      isPrimary: false,
      position: colorIndex * 2 + 2,
    },
  ]);

  return {
    sku,
    slug,
    name,
    brand: "RioShop",
    shortDescription: `${category.productLabel} dong ${collection.toLowerCase()}, chat lieu ${material.toLowerCase()}, form ${fit.toLowerCase()}.`,
    description:
      `${name} duoc phat trien theo nhu cau mac dep va de ung dung moi ngay. Chat lieu ${material} giup san pham ${benefit}, trong khi form ${fit.toLowerCase()} tao cam giac gon gang, de mac va de ket hop voi nhieu outfit khac nhau.`,
    category: {
      _id: category._id,
      name: category.name,
      slug: category.slug,
      ancestors: [],
    },
    tags: [
      "fashion-demo-2026",
      toSlug(category.name),
      toSlug(collection),
      toSlug(fit),
      toSlug(material),
    ],
    gender: category.gender,
    ageGroup: category.ageGroup,
    material: [material, "Spandex nhe", "Be mat de chiu"],
    care: CARE_GUIDE,
    origin: "Viet Nam",
    variants,
    media,
    sizeChart: {
      unit: "cm",
      rows: buildSizeChartRows(category.sizes),
    },
    pricing: {
      basePrice,
      salePrice,
      currency: "VND",
    },
    inventorySummary: {
      total: 260 + productIndex * 12,
      available: 220 + productIndex * 10,
      reserved: 40,
    },
    ratings: {
      avg: ratingAvg,
      count: ratingCount,
      dist: {
        5: Math.floor(ratingCount * 0.61),
        4: Math.floor(ratingCount * 0.24),
        3: Math.floor(ratingCount * 0.09),
        2: Math.floor(ratingCount * 0.04),
        1: Math.floor(ratingCount * 0.02),
      },
    },
    returnPolicy: {
      days: 30,
      conditions: "San pham chua qua su dung, con tem mac va hoa don",
      freeReturn: true,
    },
    seoMeta: {
      title: `${name} | RioShop`,
      description: `Mua ${name} tai RioShop voi chat lieu ${material}, form ${fit} va chinh sach doi tra linh hoat.`,
      keywords: [category.productLabel, collection, fit, material, "RioShop"],
    },
    status: "active",
    isFeatured: productIndex < 5,
    isNew: productIndex >= CATALOG_SIZE_PER_CATEGORY - 3,
    isBestseller: sold > 1400,
    weight: 250 + productIndex * 10,
    dimensions: {
      lengthCm: 28 + (productIndex % 4) * 2,
      widthCm: 22 + (productIndex % 3) * 2,
      heightCm: 4 + (productIndex % 2),
    },
    totalSold: sold,
    viewCount: sold * 6,
    deletedAt: null,
    createdAt,
    updatedAt: now,
    publishedAt: createdAt,
  };
};

const upsertProducts = async (categories) => {
  const payloads = [];

  categories.forEach((category, categoryIndex) => {
    for (let productIndex = 0; productIndex < CATALOG_SIZE_PER_CATEGORY; productIndex += 1) {
      payloads.push(buildProductPayload(category, categoryIndex, productIndex));
    }
  });

  const operations = payloads.map((product) => ({
    updateOne: {
      filter: { slug: product.slug, deletedAt: null },
      update: {
        $set: {
          ...product,
          updatedAt: now,
        },
      },
      upsert: true,
    },
  }));

  await Product.bulkWrite(operations, { ordered: false });

  return Product.find({
    slug: { $in: payloads.map((item) => item.slug) },
    deletedAt: null,
    status: "active",
  });
};

const refreshCategoryCounts = async () => {
  const grouped = await Product.aggregate([
    { $match: { deletedAt: null, status: "active" } },
    { $group: { _id: "$category._id", count: { $sum: 1 } } },
  ]);

  const updateOps = grouped.map((item) => ({
    updateOne: {
      filter: { _id: item._id },
      update: {
        $set: {
          productCount: item.count,
          updatedAt: now,
        },
      },
    },
  }));

  if (updateOps.length > 0) {
    await Category.bulkWrite(updateOps, { ordered: false });
  }
};

const upsertFlashSales = async (products) => {
  const discountedProducts = [...products]
    .filter((item) => item.pricing?.basePrice > item.pricing?.salePrice)
    .sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0));

  const runningSlots = discountedProducts.slice(0, 8).map((product, index) => ({
    productId: product._id,
    variantSku: product.variants?.[0]?.sku,
    salePrice: Math.max(69000, roundToThousand(product.pricing.salePrice * (0.82 + (index % 3) * 0.03))),
    stockLimit: 120 + index * 20,
    sold: Math.min(190, 40 + index * 18),
  }));

  const upcomingSlots = discountedProducts.slice(8, 16).map((product, index) => ({
    productId: product._id,
    variantSku: product.variants?.[1]?.sku,
    salePrice: Math.max(69000, roundToThousand(product.pricing.salePrice * (0.86 + (index % 2) * 0.03))),
    stockLimit: 100 + index * 18,
    sold: 0,
  }));

  const runningSale = {
    name: "Flash Sale Tu Chon Cuoi Tuan",
    banner: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1800&q=80",
    startsAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
    endsAt: new Date(now.getTime() + 18 * 60 * 60 * 1000),
    slots: runningSlots,
    isActive: true,
    createdAt: now,
  };

  const upcomingSale = {
    name: "Deal Thu Hai Dau Tuan",
    banner: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1800&q=80",
    startsAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    endsAt: new Date(now.getTime() + 72 * 60 * 60 * 1000),
    slots: upcomingSlots,
    isActive: true,
    createdAt: now,
  };

  await FlashSale.findOneAndUpdate(
    { name: runningSale.name },
    { $set: runningSale },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );

  await FlashSale.findOneAndUpdate(
    { name: upcomingSale.name },
    { $set: upcomingSale },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
};

const upsertBrandConfig = async () => {
  const payload = {
    brandKey: BRAND_KEY,
    displayName: "RioShop",
    logo: {
      light: "https://dummyimage.com/320x90/111827/ffffff&text=RioShop",
      dark: "https://dummyimage.com/320x90/ffffff/111827&text=RioShop",
    },
    theme: {
      primaryColor: "#0f172a",
      secondaryColor: "#2563eb",
      fontFamily: "Manrope, Segoe UI, sans-serif",
    },
    paymentGateways: [
      { provider: "cod", isActive: true, config: { fee: 0 } },
      { provider: "momo", isActive: true, config: { mode: "test" } },
      { provider: "vnpay", isActive: true, config: { mode: "sandbox" } },
    ],
    shippingRules: [
      {
        method: "standard",
        carriers: ["GHN", "GHTK", "Viettel Post"],
        feeSchedule: { baseFee: 30000, freeShipFrom: 299000 },
      },
      {
        method: "express",
        carriers: ["Ahamove", "GrabExpress"],
        feeSchedule: { baseFee: 45000, innerCity2h: true },
      },
    ],
    taxRate: 0.1,
    supportEmail: "support@rioshop.vn",
    supportPhone: "1900 6868",
    socialLinks: {
      facebook: "https://facebook.com/rioshopvn",
      instagram: "https://instagram.com/rioshopvn",
      tiktok: "https://tiktok.com/@rioshopvn",
      youtube: "https://youtube.com/@rioshopvn",
    },
    featureFlags: {
      loyalty: true,
      flashSale: true,
      review: true,
    },
    storefront: {
      home: {
        hero: {
          kicker: "Thoi trang co ban de mac moi ngay",
          titleLine1: "Mac dep",
          titleLine2: "gon gang va de chon hon.",
          description:
            "Bo du lieu demo cho storefront duoc thiet ke theo phong cach thoi trang co ban: nhom san pham ro rang, gia hop ly, de loc, de tim va de trinh bay tren trang chu.",
          primaryCtaLabel: "Mua ngay",
          secondaryCtaLabel: "Xem bo suu tap",
          dealDescription: "Cap nhat deal theo nhom san pham ban chay, ton kho on dinh va hinh anh seed rieng cho tung san pham.",
          sideKicker: "Dong bo danh muc",
          sideTitleLine1: "Ao thun, polo, so mi,",
          sideTitleLine2: "quan, dam va phu kien",
          sideDescription:
            "Cau truc du lieu phu hop cho mot website thoi trang co ban, de demo trang danh muc, chi tiet, flash sale va bo loc.",
          dealCtaLabel: "Xem deal hom nay",
          sideCtaLabel: "Kham pha ngay",
          metrics: [
            { value: "120+", label: "San pham demo trong catalog" },
            { value: "10", label: "Danh muc thoi trang co ban" },
            { value: "3 mau", label: "Mau sac tren moi san pham tieu bieu" },
          ],
        },
        sections: {
          categoriesMiniTitle: "Danh muc noi bat",
          categoriesTitle: "Chon nhanh theo nhu cau",
          categoriesLinkLabel: "Xem them",
          flashSaleMiniTitle: "Deal hom nay",
          flashSaleTitle: "Flash sale demo",
          flashSaleLinkLabel: "Tat ca deal",
          productsMiniTitle: "Ban chay",
          productsTitle: "San pham noi bat trong tuan",
          productsLinkLabel: "Xem tat ca",
        },
        labels: {
          flashDeal: "Flash Deal",
          soldPercentPrefix: "Da ban",
          soldOutSoon: "Sap het hang",
          dealFallbackTitle: "Uu dai trong ngay",
          buyDeal: "Mua deal nay",
          exploreNow: "Kham pha ngay",
          noCategories: "Chua co danh muc phu hop de hien thi.",
          noFlashSales: "Hien chua co flash sale dang dien ra.",
          noProducts: "Chua co san pham noi bat de hien thi.",
          loadingCategories: "Dang tai danh muc...",
          loadingFlashSales: "Dang tai flash sale...",
          loadingProducts: "Dang tai san pham noi bat...",
        },
        valueProps: [
          {
            title: "Mau sac de ban",
            text: "Moi san pham co nhieu bien the de demo bo loc va lua chon trong chi tiet san pham.",
            iconKey: "truck",
          },
          {
            title: "Gia phan khuc ro rang",
            text: "Tu thoi trang co ban den nhom premium de demo listing va pricing.",
            iconKey: "return",
          },
          {
            title: "Noi dung seed dong bo",
            text: "Ten, mo ta, tags, size chart va hinh anh duoc tao moi theo mot he thong nhat quan.",
            iconKey: "shield",
          },
        ],
        journal: {
          kicker: "Rio Journal",
          titleLine1: "Goi y phoi do",
          titleLine2: "de ung dung hon.",
          description: "Huong den trai nghiem demo giong cac website ban le thoi trang co ban tren thi truong.",
          ctaLabel: "Xem lookbook",
        },
        member: {
          kicker: "Rio Member",
          title: "Nhan uu dai cho don dau",
          description: "Dang ky de nhan ma giam gia, thong bao deal moi va cap nhat bo suu tap.",
          emailPlaceholder: "Nhap email cua ban",
          ctaLabel: "Dang ky",
        },
        apiNotice: "Du lieu demo duoc tao moi cho moi truong local, phuc vu test giao dien va chuc nang storefront.",
      },
    },
    maintenanceMode: false,
    updatedAt: now,
  };

  await BrandConfig.findOneAndUpdate(
    { brandKey: payload.brandKey },
    { $set: payload },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
};

const main = async () => {
  await connectDB();

  const categories = await upsertCategories();
  const products = await upsertProducts(categories);
  await refreshCategoryCounts();
  await upsertFlashSales(products);
  await upsertBrandConfig();

  const categoryCount = await Category.countDocuments({ deletedAt: null, isActive: true });
  const productCount = await Product.countDocuments({ deletedAt: null, status: "active" });
  const flashSaleCount = await FlashSale.countDocuments({});

  console.log("Seed fashion demo data completed:");
  console.log(`- Categories active: ${categoryCount}`);
  console.log(`- Products active: ${productCount}`);
  console.log(`- Flash sales: ${flashSaleCount}`);
  console.log(`- Brand config: ${BRAND_KEY}`);
};

main()
  .catch((error) => {
    console.error("Seed fashion demo data failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  });
