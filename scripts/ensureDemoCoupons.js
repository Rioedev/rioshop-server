import dotenv from "dotenv";
import mongoose from "mongoose";
import Coupon from "../src/models/Coupon.js";

dotenv.config();

const now = new Date();
const startsAt = new Date(now);
startsAt.setDate(startsAt.getDate() - 1);

const expiresAt = new Date(now);
expiresAt.setDate(expiresAt.getDate() + 60);

const coupons = [
  {
    code: "RIO10",
    name: "Giảm 10% toàn đơn",
    description: "Giảm 10% cho đơn hàng từ 300.000đ, tối đa 80.000đ.",
    type: "percent",
    value: 10,
    maxDiscount: 80000,
    minOrderValue: 300000,
    usageLimit: 300,
    perUserLimit: 1,
  },
  {
    code: "RIO50K",
    name: "Giảm 50.000đ",
    description: "Giảm trực tiếp 50.000đ cho đơn hàng từ 500.000đ.",
    type: "fixed",
    value: 50000,
    maxDiscount: null,
    minOrderValue: 500000,
    usageLimit: 200,
    perUserLimit: 1,
  },
  {
    code: "FREESHIP",
    name: "Miễn phí vận chuyển",
    description: "Miễn phí vận chuyển cho đơn hàng từ 250.000đ.",
    type: "free_ship",
    value: 0,
    maxDiscount: 40000,
    minOrderValue: 250000,
    usageLimit: 500,
    perUserLimit: 2,
  },
  {
    code: "VIP15",
    name: "Ưu đãi thành viên VIP",
    description: "Giảm 15% cho thành viên Gold và Platinum, tối đa 150.000đ.",
    type: "percent",
    value: 15,
    maxDiscount: 150000,
    minOrderValue: 800000,
    usageLimit: 100,
    perUserLimit: 1,
    eligibleTiers: ["gold", "platinum"],
  },
];

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("Missing MONGO_URI");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const result = [];

  for (const coupon of coupons) {
    const code = coupon.code.toUpperCase();
    const existing = await Coupon.findOne({ code });

    if (existing) {
      result.push({ code, type: existing.type, status: "exists" });
      continue;
    }

    await Coupon.create({
      ...coupon,
      code,
      isActive: true,
      startsAt,
      expiresAt,
      source: "manual",
      usageCount: 0,
      usedBy: [],
      applicableTo: {
        categories: [],
        products: [],
        brands: [],
      },
      excludedProducts: [],
      eligibleUsers: [],
      createdAt: new Date(),
    });

    result.push({ code, type: coupon.type, status: "created" });
  }

  console.table(result);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
