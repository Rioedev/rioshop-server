// Quick seed: 2 flash sales for demoing the storefront.
// - 1 đang chạy ngay (kết thúc trong 6h)
// - 1 sắp tới (bắt đầu 6h nữa, kéo dài 24h)
//
// Lấy 6 SP active đầu tiên từ DB, gắn slots với giá giảm 25-40%.
//
// Run: `npm run seed:flashsales` từ server/

import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "../src/config/database.js";
import FlashSale from "../src/models/FlashSale.js";
import Product from "../src/models/Product.js";

dotenv.config();

const HOUR = 60 * 60 * 1000;

const main = async () => {
  await connectDB();

  // Tìm SP active có ít nhất 1 variant để gắn slot
  const products = await Product.find(
    { status: "active", deletedAt: null },
    { _id: 1, name: 1, slug: 1, pricing: 1, variants: 1 },
  )
    .limit(8)
    .lean();

  if (products.length === 0) {
    console.error("❌ Không có sản phẩm active nào để tạo flash sale.");
    process.exit(1);
  }

  console.log(`Tìm thấy ${products.length} SP active, dùng để tạo slots.`);

  const buildSlot = (product, discountRatio) => {
    const basePrice = Number(product.pricing?.salePrice || 0);
    const salePrice = Math.max(1000, Math.round((basePrice * (1 - discountRatio)) / 1000) * 1000);
    const firstVariant = (product.variants || []).find((v) => v.isActive !== false && v.sku);
    return {
      productId: product._id,
      variantSku: firstVariant?.sku,
      salePrice,
      stockLimit: 50 + Math.floor(Math.random() * 100),
      sold: Math.floor(Math.random() * 20),
    };
  };

  const now = new Date();

  // 1) Flash sale đang chạy ngay (đã bắt đầu 2h trước, kết thúc 6h nữa)
  const runningSale = {
    name: "FLASH SALE 14H - GIẢM SỐC ĐẾN 40%",
    banner: "/placeholder-product.svg",
    startsAt: new Date(now.getTime() - 2 * HOUR),
    endsAt: new Date(now.getTime() + 6 * HOUR),
    isActive: true,
    slots: products.slice(0, 4).map((p, i) => buildSlot(p, 0.25 + i * 0.05)),
  };

  // 2) Flash sale sắp tới (bắt đầu 6h nữa, kéo dài 24h)
  const upcomingSale = {
    name: "FLASH SALE 20H TỐI NAY",
    banner: "/placeholder-product.svg",
    startsAt: new Date(now.getTime() + 6 * HOUR),
    endsAt: new Date(now.getTime() + 30 * HOUR),
    isActive: true,
    slots: products.slice(2, 6).map((p, i) => buildSlot(p, 0.3 + i * 0.04)),
  };

  // Xoá flash sale demo cũ trùng tên để chạy nhiều lần idempotent
  await FlashSale.deleteMany({
    name: { $in: [runningSale.name, upcomingSale.name] },
  });

  const created1 = await FlashSale.create(runningSale);
  const created2 = await FlashSale.create(upcomingSale);

  console.log("\n✅ Tạo xong 2 flash sale:");
  console.log(`\n🟢 ĐANG CHẠY: "${created1.name}"`);
  console.log(`   Bắt đầu: ${created1.startsAt.toLocaleString("vi-VN")}`);
  console.log(`   Kết thúc: ${created1.endsAt.toLocaleString("vi-VN")}`);
  console.log(`   Slots (${created1.slots.length}):`);
  created1.slots.forEach((slot, i) => {
    const product = products[i];
    console.log(`     ${i + 1}. ${product?.name?.slice(0, 50)}`);
    console.log(`        ${product?.pricing?.salePrice?.toLocaleString("vi-VN")}đ → ${slot.salePrice.toLocaleString("vi-VN")}đ`);
  });

  console.log(`\n🕒 SẮP TỚI: "${created2.name}"`);
  console.log(`   Bắt đầu: ${created2.startsAt.toLocaleString("vi-VN")}`);
  console.log(`   Slots: ${created2.slots.length}`);
};

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
