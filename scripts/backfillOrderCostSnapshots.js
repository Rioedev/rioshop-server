// One-time backfill for order item cost snapshots.
//
// New orders store items.costPriceSnapshot at checkout time. Older orders do not
// have that field, so gross-profit reports would keep falling back to the current
// Product.pricing.costPrice. This script freezes old rows using the current
// weighted-average cost available at the moment the script is run.
//
// Run from server/:
//   npm run backfill:order-costs

import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const mongoUri =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  process.env.DATABASE_URL;

const toCost = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const hasSnapshot = (item = {}) => Number.isFinite(Number(item.costPriceSnapshot));

const main = async () => {
  if (!mongoUri) {
    console.error("Missing MongoDB connection string");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  const orders = mongoose.connection.db.collection("orders");
  const products = mongoose.connection.db.collection("products");

  const cursor = orders.find({
    items: {
      $elemMatch: {
        $or: [
          { costPriceSnapshot: { $exists: false } },
          { costPriceSnapshot: null },
        ],
      },
    },
  });

  let scanned = 0;
  let updated = 0;
  let touchedItems = 0;
  const missingProducts = new Set();

  for await (const order of cursor) {
    scanned += 1;
    const items = Array.isArray(order.items) ? order.items : [];
    const missingProductIds = [
      ...new Set(
        items
          .filter((item) => !hasSnapshot(item) && item.productId)
          .map((item) => item.productId),
      ),
    ];

    if (missingProductIds.length === 0) {
      continue;
    }

    const productRows = await products
      .find({ _id: { $in: missingProductIds } }, { projection: { "pricing.costPrice": 1 } })
      .toArray();
    const costByProductId = new Map(
      productRows.map((product) => [
        product._id.toString(),
        toCost(product.pricing?.costPrice),
      ]),
    );

    let changed = false;
    const nextItems = items.map((item) => {
      if (hasSnapshot(item)) {
        return item;
      }

      const productId = item.productId?.toString?.() || "";
      if (productId && !costByProductId.has(productId)) {
        missingProducts.add(productId);
      }

      changed = true;
      touchedItems += 1;
      return {
        ...item,
        costPriceSnapshot: costByProductId.get(productId) ?? 0,
      };
    });

    if (!changed) {
      continue;
    }

    await orders.updateOne(
      { _id: order._id },
      {
        $set: {
          items: nextItems,
          updatedAt: new Date(),
        },
      },
    );
    updated += 1;
  }

  console.log("Order cost snapshot backfill done.");
  console.log(`- Orders scanned: ${scanned}`);
  console.log(`- Orders updated: ${updated}`);
  console.log(`- Items backfilled: ${touchedItems}`);
  console.log(`- Missing product refs: ${missingProducts.size}`);
};

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
