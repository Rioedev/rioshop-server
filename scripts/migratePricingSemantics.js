// One-time migration from legacy product pricing names:
//   salePrice -> regularPrice
//   basePrice -> compareAtPrice
//
// The legacy fields are intentionally kept as aliases for backward compatibility,
// but regularPrice/compareAtPrice are the canonical business terms.
// Run:
//   node scripts/migratePricingSemantics.js
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const mongoUri =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  process.env.DATABASE_URL;

const toMoneyNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
};

(async () => {
  try {
    if (!mongoUri) {
      console.error("Missing MongoDB connection string");
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    const products = mongoose.connection.db.collection("products");

    const cursor = products.find({
      deletedAt: null,
      $or: [
        { "pricing.salePrice": { $exists: true } },
        { "pricing.basePrice": { $exists: true } },
        { "pricing.regularPrice": { $exists: false } },
        { "pricing.compareAtPrice": { $exists: false } },
      ],
    });

    let scanned = 0;
    let updated = 0;
    let skipped = 0;

    for await (const product of cursor) {
      scanned += 1;
      const pricing = product.pricing || {};
      const regularPrice = toMoneyNumber(
        pricing.regularPrice,
        toMoneyNumber(pricing.salePrice, 0),
      );
      const rawCompareAtPrice = toMoneyNumber(
        pricing.compareAtPrice,
        toMoneyNumber(pricing.basePrice, 0),
      );
      const compareAtPrice =
        rawCompareAtPrice > 0 && rawCompareAtPrice < regularPrice ? 0 : rawCompareAtPrice;

      if (regularPrice <= 0 && !pricing.salePrice && !pricing.regularPrice) {
        skipped += 1;
        continue;
      }

      await products.updateOne(
        { _id: product._id },
        {
          $set: {
            "pricing.regularPrice": regularPrice,
            "pricing.compareAtPrice": compareAtPrice,
            "pricing.salePrice": regularPrice,
            "pricing.basePrice": compareAtPrice,
            updatedAt: new Date(),
          },
        },
      );
      updated += 1;
    }

    console.log(
      `Pricing migration done. scanned=${scanned}, updated=${updated}, skipped=${skipped}`,
    );
  } catch (error) {
    console.error("Pricing migration failed:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
})();
