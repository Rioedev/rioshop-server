// Hard-delete analytics events older than N days.
//
// Run: `npm run purge:analytics` (default 90 days)
//      `npm run purge:analytics -- --days=30` (giữ 30 ngày gần nhất)
//      `npm run purge:analytics -- --days=7 --event=page_view` (chỉ purge page_view cũ hơn 7 ngày)
//
// Có thể chạy định kỳ bằng cron/Task Scheduler (vd 0 3 * * * — 3h sáng mỗi ngày).
//
// Lưu ý: model AnalyticsEvent đã có TTL index (mặc định 365 ngày). Script này dùng để
// purge sớm hơn TTL khi DB phình to. Nếu muốn TTL ngắn vĩnh viễn, sửa
// `expireAfterSeconds` trong models/AnalyticsEvent.js.

import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "../src/config/database.js";
import AnalyticsEvent from "../src/models/AnalyticsEvent.js";

dotenv.config();

const parseArgs = () => {
  const args = { days: 60, event: null };
  for (const raw of process.argv.slice(2)) {
    const [key, value] = raw.replace(/^--/, "").split("=");
    if (key === "days") args.days = Number(value);
    if (key === "event") args.event = value;
  }
  if (!Number.isFinite(args.days) || args.days < 0) {
    console.error("❌ --days phải là số nguyên ≥ 0");
    process.exit(1);
  }
  return args;
};

const main = async () => {
  const { days, event } = parseArgs();
  await connectDB();

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const filter = { createdAt: { $lt: cutoff } };
  if (event) filter.event = event;

  console.log(`Cutoff: ${cutoff.toISOString()} (giữ lại data ≤ ${days} ngày)`);
  if (event) console.log(`Chỉ xóa event: ${event}`);

  const totalBefore = await AnalyticsEvent.estimatedDocumentCount();
  console.log(`Tổng analytics events hiện tại: ${totalBefore.toLocaleString("vi-VN")}`);

  const matchCount = await AnalyticsEvent.countDocuments(filter);
  console.log(`Sẽ xóa: ${matchCount.toLocaleString("vi-VN")} bản ghi`);

  if (matchCount === 0) {
    console.log("✅ Không có gì để xóa.");
    return;
  }

  const breakdownAggregate = await AnalyticsEvent.aggregate([
    { $match: filter },
    { $group: { _id: "$event", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  console.log("\nPhân loại theo event:");
  breakdownAggregate.forEach((row) => {
    console.log(`  • ${row._id}: ${row.count.toLocaleString("vi-VN")}`);
  });

  const result = await AnalyticsEvent.deleteMany(filter);
  const totalAfter = await AnalyticsEvent.estimatedDocumentCount();

  console.log(`\n✅ Đã xóa ${result.deletedCount.toLocaleString("vi-VN")} bản ghi.`);
  console.log(`Tổng còn lại: ${totalAfter.toLocaleString("vi-VN")}`);
};

main()
  .catch((error) => {
    console.error("Purge failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
