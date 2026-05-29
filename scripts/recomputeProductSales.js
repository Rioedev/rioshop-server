// Recompute Product.totalSold from real orders.
//
// Counts:
// - All orders whose status is in COMMITTED_STATUSES (packing onwards) AND not cancelled
// - Sums (quantity - returnedQty) per productId
// - Updates Product.totalSold to match
//
// Run: `npm run recompute:sales` from server/
//
// Safe: idempotent — running it multiple times produces the same result.
// Use this whenever you suspect totalSold has drifted from reality (after data import,
// bulk seed, manual order edits, etc).

import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "../src/config/database.js";
import Order from "../src/models/Order.js";
import Product from "../src/models/Product.js";

dotenv.config();

// Statuses where stock has been committed (Product.totalSold should include them).
// Mirrors INVENTORY_COMMIT_AT_STATUS default in orderService.js ("packing").
const COMMITTED_STATUSES = ["packing", "ready_to_ship", "shipping", "delivered", "completed"];

const main = async () => {
  await connectDB();
  console.log(`Reading orders with status ∈ {${COMMITTED_STATUSES.join(", ")}}...`);

  const aggregation = await Order.aggregate([
    { $match: { status: { $in: COMMITTED_STATUSES } } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.productId",
        soldQty: {
          $sum: {
            $max: [
              { $subtract: ["$items.quantity", { $ifNull: ["$items.returnedQty", 0] }] },
              0,
            ],
          },
        },
        orderCount: { $sum: 1 },
      },
    },
  ]);

  console.log(`Found sales activity for ${aggregation.length} product(s).`);

  const computedMap = new Map(
    aggregation.map((row) => [row._id.toString(), row.soldQty]),
  );

  const allProducts = await Product.find({ deletedAt: null }, { _id: 1, totalSold: 1, name: 1 });

  let updated = 0;
  let zeroed = 0;
  let unchanged = 0;
  const examples = [];

  for (const product of allProducts) {
    const computed = computedMap.get(product._id.toString()) ?? 0;
    const current = Number(product.totalSold || 0);

    if (current === computed) {
      unchanged += 1;
      continue;
    }

    if (examples.length < 8) {
      examples.push({
        name: product.name,
        before: current,
        after: computed,
      });
    }

    await Product.updateOne({ _id: product._id }, { $set: { totalSold: computed } });
    if (computed === 0) {
      zeroed += 1;
    } else {
      updated += 1;
    }
  }

  console.log("\nRecompute summary:");
  console.log(`- Total products: ${allProducts.length}`);
  console.log(`- Unchanged: ${unchanged}`);
  console.log(`- Updated to a positive number: ${updated}`);
  console.log(`- Reset to 0 (no committed orders found): ${zeroed}`);

  if (examples.length > 0) {
    console.log("\nSample changes:");
    examples.forEach((entry) => {
      console.log(`  • "${entry.name}": ${entry.before} → ${entry.after}`);
    });
  }
};

main()
  .catch((error) => {
    console.error("Recompute failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
