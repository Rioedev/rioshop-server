// Reset giá vốn của tất cả sản phẩm về 60% giá bán + xóa variant.costPrice cũ.
// Dùng để chuẩn hóa data demo cho báo cáo bán hàng có margin hợp lý ~40%.
// Chạy 1 lần:
//   node scripts/reseedCostPrice.js
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const COST_RATIO = 0.6; // 60% giá bán

(async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("MONGO_URI not set");
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGO_URI);
    const coll = mongoose.connection.db.collection("products");

    // Tìm tất cả product chưa xóa
    const all = await coll.find({ deletedAt: null }).toArray();
    console.log(`Found ${all.length} active products`);

    let updated = 0;
    for (const p of all) {
      const salePrice = Number(p.pricing?.salePrice || 0);
      if (salePrice <= 0) continue;
      const newCost = Math.round(salePrice * COST_RATIO);

      // Xóa luôn variant.costPrice orphan (dirty data từ schema cũ)
      const variants = (p.variants || []).map((v) => {
        const { costPrice, ...rest } = v;
        return rest;
      });

      await coll.updateOne(
        { _id: p._id },
        {
          $set: {
            "pricing.costPrice": newCost,
            variants,
            updatedAt: new Date(),
          },
        },
      );
      updated++;
    }
    console.log(`Updated ${updated} products. costPrice = ${COST_RATIO * 100}% salePrice. Dropped variant.costPrice.`);
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
})();
