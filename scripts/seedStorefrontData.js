import dotenv from "dotenv";
import mongoose from "mongoose";
import slugify from "slugify";

import connectDB from "../src/config/database.js";
import BrandConfig from "../src/models/BrandConfig.js";
import Category from "../src/models/Category.js";
import FlashSale from "../src/models/FlashSale.js";
import Product from "../src/models/Product.js";

dotenv.config();

const CATALOG_SIZE_PER_CATEGORY = 14;
const BRAND_KEY = "rioshop-default";
const now = new Date();

const CATEGORY_BLUEPRINTS = [
  {
    code: "TEE",
    name: "Áo thun",
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80",
    minPrice: 179000,
    maxPrice: 329000,
    gender: "unisex",
  },
  {
    code: "POL",
    name: "Áo polo",
    image: "https://images.unsplash.com/photo-1622470953794-aa9c70b0fb9d?auto=format&fit=crop&w=1200&q=80",
    minPrice: 259000,
    maxPrice: 429000,
    gender: "men",
  },
  {
    code: "SHT",
    name: "Sơ mi",
    image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=1200&q=80",
    minPrice: 289000,
    maxPrice: 519000,
    gender: "unisex",
  },
  {
    code: "JKT",
    name: "Áo khoác",
    image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1200&q=80",
    minPrice: 399000,
    maxPrice: 899000,
    gender: "unisex",
  },
  {
    code: "SHR",
    name: "Quần short",
    image: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&w=1200&q=80",
    minPrice: 219000,
    maxPrice: 429000,
    gender: "unisex",
  },
  {
    code: "CHN",
    name: "Quần dài",
    image: "https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=1200&q=80",
    minPrice: 329000,
    maxPrice: 699000,
    gender: "unisex",
  },
  {
    code: "GYM",
    name: "Đồ tập",
    image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80",
    minPrice: 239000,
    maxPrice: 589000,
    gender: "unisex",
  },
  {
    code: "RUN",
    name: "Đồ chạy bộ",
    image: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=1200&q=80",
    minPrice: 259000,
    maxPrice: 599000,
    gender: "unisex",
  },
  {
    code: "HME",
    name: "Đồ mặc nhà",
    image: "https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=1200&q=80",
    minPrice: 189000,
    maxPrice: 399000,
    gender: "unisex",
  },
  {
    code: "UWM",
    name: "Đồ lót nam",
    image: "https://images.unsplash.com/photo-1603251578711-3290ca1a0181?auto=format&fit=crop&w=1200&q=80",
    minPrice: 99000,
    maxPrice: 299000,
    gender: "men",
  },
  {
    code: "UWW",
    name: "Đồ lót nữ",
    image: "https://images.unsplash.com/photo-1549062572-544a64fb0c56?auto=format&fit=crop&w=1200&q=80",
    minPrice: 119000,
    maxPrice: 349000,
    gender: "women",
  },
  {
    code: "ACS",
    name: "Phụ kiện",
    image: "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80",
    minPrice: 79000,
    maxPrice: 259000,
    gender: "unisex",
  },
];

const COLLECTION_NAMES = [
  "Essential",
  "Urban",
  "Daily",
  "Studio",
  "Motion",
  "Prime",
  "Core",
  "Flex",
  "Nova",
  "Breeze",
  "Heritage",
  "Minimal",
  "Aero",
  "Voyage",
];

const MATERIALS = [
  "Cotton Compact",
  "Cotton Air",
  "Modal Bamboo",
  "Linen Blend",
  "Poly Stretch",
  "Nylon Light",
  "French Terry",
  "Coolmax",
];

const FITS = ["Regular Fit", "Relaxed Fit", "Slim Fit", "Boxy Fit", "Athletic Fit"];
const SIZES = ["S", "M", "L", "XL"];

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
            description: `${item.name} chuẩn chỉnh cho nhu cầu mặc hàng ngày, chất liệu tốt và form dễ phối đồ.`,
            parentId: null,
            ancestors: [],
            level: 0,
            path: slug,
            image: item.image,
            icon: "",
            position: index + 1,
            isActive: true,
            deletedAt: null,
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
  const productNo = String(productIndex + 1).padStart(2, "0");
  const collection = COLLECTION_NAMES[(categoryIndex + productIndex) % COLLECTION_NAMES.length];
  const fit = FITS[(categoryIndex * 2 + productIndex) % FITS.length];
  const material = MATERIALS[(categoryIndex + productIndex * 3) % MATERIALS.length];
  const name = `${category.name} ${collection} ${fit} ${productNo}`;
  const slug = toSlug(`${name} ${category.code}`);
  const sku = `RIO-${category.code}-${String(productIndex + 1).padStart(3, "0")}`;

  const basePriceRaw = rangeValue((categoryIndex + 1) * 100 + productIndex + 1, category.minPrice, category.maxPrice);
  const basePrice = roundToThousand(basePriceRaw);
  const discountRatio = [1, 0.95, 0.9, 0.85, 0.8][(categoryIndex + productIndex) % 5];
  const salePrice = roundToThousand(basePrice * discountRatio);

  const sold = Math.floor(rangeValue((categoryIndex + 1) * 1000 + productIndex, 90, 3800));
  const ratingAvg = Number((4.3 + deterministic((categoryIndex + 3) * 2000 + productIndex) * 0.7).toFixed(1));
  const ratingCount = Math.floor(rangeValue((categoryIndex + 5) * 1300 + productIndex, 20, 1200));

  const createdAt = new Date(now.getTime() - Math.floor(rangeValue((categoryIndex + 9) * 1500 + productIndex, 1, 180)) * 86400000);
  const isFeatured = productIndex < 6;
  const isBestseller = sold > 1300;
  const isNew = productIndex >= CATALOG_SIZE_PER_CATEGORY - 4;

  const variants = SIZES.map((size, sizeIndex) => ({
    variantId: `${sku}-${size}`,
    sku: `${sku}-${size}`,
    size,
    sizeLabel: size,
    additionalPrice: sizeIndex >= 2 ? 10000 : 0,
    barcode: `${category.code}${productIndex + 1}${sizeIndex + 1}${String(categoryIndex).padStart(2, "0")}`,
    images: [
      `https://picsum.photos/seed/rioshop-${slug}-${size.toLowerCase()}-1/1200/1400`,
      `https://picsum.photos/seed/rioshop-${slug}-${size.toLowerCase()}-2/1200/1400`,
    ],
    isActive: true,
    position: sizeIndex + 1,
  }));

  const media = [1, 2, 3].map((mediaIndex) => ({
    url: `https://picsum.photos/seed/rioshop-${slug}-media-${mediaIndex}/1200/1400`,
    type: "image",
    altText: `${name} - ảnh ${mediaIndex}`,
    isPrimary: mediaIndex === 1,
    position: mediaIndex,
  }));

  return {
    sku,
    slug,
    name,
    brand: "RioShop",
    shortDescription: `${category.name} phiên bản ${collection.toLowerCase()}, chất liệu ${material.toLowerCase()}, form ${fit.toLowerCase()}.`,
    description:
      `${name} được phát triển cho trải nghiệm mặc thoải mái cả ngày. Chất liệu ${material} giúp bề mặt mềm, thoáng, ít nhăn và giữ form ổn định sau nhiều lần giặt.`,
    category: {
      _id: category._id,
      name: category.name,
      slug: category.slug,
      ancestors: [],
    },
    tags: [
      "seed-storefront-v2026",
      toSlug(category.name),
      toSlug(collection),
      toSlug(fit),
    ],
    gender: category.gender,
    ageGroup: "adult",
    material: [material, "Spandex nhẹ", "Khử mùi nhẹ"],
    care: [
      "Giặt máy chế độ nhẹ dưới 30°C",
      "Không dùng thuốc tẩy",
      "Phơi nơi thoáng mát, tránh nắng gắt",
    ],
    origin: "Việt Nam",
    variants,
    media,
    pricing: {
      basePrice,
      salePrice,
      currency: "VND",
    },
    inventorySummary: {
      total: 320,
      available: 280,
      reserved: 40,
    },
    ratings: {
      avg: ratingAvg,
      count: ratingCount,
      dist: {
        5: Math.floor(ratingCount * 0.62),
        4: Math.floor(ratingCount * 0.25),
        3: Math.floor(ratingCount * 0.08),
        2: Math.floor(ratingCount * 0.03),
        1: Math.floor(ratingCount * 0.02),
      },
    },
    returnPolicy: {
      days: 60,
      conditions: "Sản phẩm chưa qua sử dụng, còn tem mác đầy đủ",
      freeReturn: true,
    },
    seoMeta: {
      title: `${name} | RioShop`,
      description: `Mua ${name} chính hãng tại RioShop, giao nhanh và đổi trả 60 ngày.`,
      keywords: [category.name, collection, fit, "RioShop"],
    },
    status: "active",
    isFeatured,
    isNew,
    isBestseller,
    totalSold: sold,
    viewCount: sold * 5,
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

  const products = await Product.find({
    slug: { $in: payloads.map((item) => item.slug) },
    deletedAt: null,
    status: "active",
  });

  return products;
};

const refreshCategoryCounts = async () => {
  const grouped = await Product.aggregate([
    {
      $match: {
        deletedAt: null,
        status: "active",
      },
    },
    {
      $group: {
        _id: "$category._id",
        count: { $sum: 1 },
      },
    },
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
  const sortedProducts = [...products]
    .filter((item) => item.pricing?.basePrice > item.pricing?.salePrice)
    .sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0));

  const runningSlots = sortedProducts.slice(0, 8).map((product, index) => {
    const dealPrice = roundToThousand(product.pricing.salePrice * (0.84 + (index % 3) * 0.03));
    const stockLimit = 140 + index * 30;
    const sold = Math.min(stockLimit - 4, Math.floor(stockLimit * (0.42 + (index % 4) * 0.1)));

    return {
      productId: product._id,
      variantSku: product.variants?.[0]?.sku,
      salePrice: Math.max(69000, dealPrice),
      stockLimit,
      sold,
    };
  });

  const upcomingSlots = sortedProducts.slice(8, 16).map((product, index) => {
    const dealPrice = roundToThousand(product.pricing.salePrice * (0.88 + (index % 3) * 0.02));

    return {
      productId: product._id,
      variantSku: product.variants?.[1]?.sku,
      salePrice: Math.max(69000, dealPrice),
      stockLimit: 120 + index * 20,
      sold: 0,
    };
  });

  const runningSale = {
    name: "Flash Sale Khung Giờ Vàng",
    banner: "https://images.unsplash.com/photo-1518458028785-8fbcd101ebb9?auto=format&fit=crop&w=1800&q=80",
    startsAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
    endsAt: new Date(now.getTime() + 20 * 60 * 60 * 1000),
    slots: runningSlots,
    isActive: true,
    createdAt: now,
  };

  const upcomingSale = {
    name: "Flash Sale Cuối Tuần",
    banner: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1800&q=80",
    startsAt: new Date(now.getTime() + 30 * 60 * 60 * 1000),
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
      secondaryColor: "#0ea5e9",
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
          kicker: "Bộ sưu tập Xuân Hè 2026",
          titleLine1: "Giao diện bán hàng",
          titleLine2: "đẹp, rõ ràng và chuyển đổi.",
          description:
            "Trang chủ RioShop được làm mới theo flow mua sắm thực tế: ưu đãi nổi bật, danh mục rõ ràng, deal trong ngày, sản phẩm bán chạy và CTA đăng ký thành viên.",
          primaryCtaLabel: "Mua ngay",
          secondaryCtaLabel: "Xem bộ sưu tập",
          dealDescription: "Giá tốt trong khung giờ vàng, số lượng giới hạn và cập nhật liên tục theo chương trình.",
          sideKicker: "Cập nhật mỗi tuần",
          sideTitleLine1: "Drop mới mỗi tuần",
          sideTitleLine2: "form đẹp, chất tốt",
          sideDescription:
            "Tập trung vào form dễ mặc, chất liệu thoáng và bảng màu trung tính để phối đồ nhanh mỗi ngày.",
          dealCtaLabel: "Mua deal này",
          sideCtaLabel: "Khám phá ngay",
          metrics: [
            { value: "4.9/5", label: "Đánh giá trung bình từ khách hàng mua sắm" },
            { value: "24h", label: "Xử lý đơn hàng trong ngày trên toàn hệ thống" },
            { value: "60 ngày", label: "Đổi trả linh hoạt nếu sản phẩm chưa vừa ý" },
          ],
        },
        sections: {
          categoriesMiniTitle: "Danh mục mua nhiều",
          categoriesTitle: "Chọn nhanh theo nhu cầu",
          categoriesLinkLabel: "Xem thêm",
          flashSaleMiniTitle: "Deal hôm nay",
          flashSaleTitle: "Khuyến mãi giờ vàng",
          flashSaleLinkLabel: "Tất cả deal",
          productsMiniTitle: "Best seller",
          productsTitle: "Sản phẩm nổi bật tuần này",
          productsLinkLabel: "Xem tất cả",
        },
        labels: {
          flashDeal: "Flash Deal",
          soldPercentPrefix: "Đã bán",
          soldOutSoon: "Sắp hết hàng",
          dealFallbackTitle: "Ưu đãi trong ngày",
          buyDeal: "Mua deal này",
          exploreNow: "Khám phá ngay",
          noCategories: "Chưa có danh mục phù hợp để hiển thị.",
          noFlashSales: "Hiện chưa có flash sale đang diễn ra.",
          noProducts: "Chưa có sản phẩm nổi bật để hiển thị.",
          loadingCategories: "Đang tải danh mục...",
          loadingFlashSales: "Đang tải flash sale...",
          loadingProducts: "Đang tải sản phẩm nổi bật...",
        },
        valueProps: [
          {
            title: "Giao nhanh 2h nội thành",
            text: "Hỗ trợ giao nhanh tại Hà Nội và TP.HCM với đơn hàng đặt trước 16:00.",
            iconKey: "truck",
          },
          {
            title: "Đổi trả 60 ngày",
            text: "Đổi size, đổi màu hoặc hoàn tiền linh hoạt nếu sản phẩm chưa vừa ý.",
            iconKey: "return",
          },
          {
            title: "Cam kết chính hãng",
            text: "Hoàn 200% nếu phát hiện sản phẩm không đúng chất lượng đã công bố.",
            iconKey: "shield",
          },
        ],
        journal: {
          kicker: "Rio Journal",
          titleLine1: "Mặc đẹp mỗi ngày,",
          titleLine2: "đơn giản hơn.",
          description: "Gợi ý outfit theo tình huống thực tế: đi làm, đi chơi, tập luyện và du lịch cuối tuần.",
          ctaLabel: "Xem lookbook",
        },
        member: {
          kicker: "Rio Member",
          title: "Nhận ưu đãi 10% cho đơn đầu",
          description: "Đăng ký để nhận mã giảm giá, thông báo deal mới và các đợt mở bán sớm cho thành viên.",
          emailPlaceholder: "Nhập email của bạn",
          ctaLabel: "Đăng ký",
        },
        apiNotice:
          "Một phần dữ liệu trang chủ đang tạm thời dùng phương án dự phòng do API chưa phản hồi đầy đủ.",
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

  console.log("Seed storefront data completed:");
  console.log(`- Categories active: ${categoryCount}`);
  console.log(`- Products active: ${productCount}`);
  console.log(`- Flash sales: ${flashSaleCount}`);
  console.log(`- Brand config: ${BRAND_KEY}`);
};

main()
  .catch((error) => {
    console.error("Seed storefront data failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  });
