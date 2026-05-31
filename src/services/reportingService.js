import Order from "../models/Order.js";
import Product from "../models/Product.js";

// Báo cáo bán hàng — đọc thẳng Order, không nhân bản số.
// Quy ước revenue:
//   - Chỉ tính các đơn KHÔNG ở trạng thái cancelled/returned
//   - Doanh thu / item = sum(item.unitPrice * item.quantity) — tức subtotal trước
//     coupon và shipping. Có thể bổ sung revenue net sau này.
//   - Quantity sold = sum(item.quantity)
//
// Helper chung: filter ngày + status. Tham số `from`/`to` (ISO date) tùy chọn.

const REVENUE_STATUSES = ["pending", "confirmed", "packing", "ready_to_ship", "shipping", "delivered", "completed"];

class ReportingService {
  buildMatchFilter({ from, to } = {}) {
    const match = { status: { $in: REVENUE_STATUSES } };
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to);
    }
    return match;
  }

  // Top N sản phẩm bán chạy nhất theo doanh thu hoặc số lượng.
  async getTopProducts({ from, to, limit = 20, sortBy = "revenue" } = {}) {
    const match = this.buildMatchFilter({ from, to });
    const sortField = sortBy === "quantity" ? "quantitySold" : "revenue";

    const rows = await Order.aggregate([
      { $match: match },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          productName: { $first: "$items.productName" },
          quantitySold: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] } },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { [sortField]: -1 } },
      { $limit: Math.max(1, Math.min(100, Number(limit) || 20)) },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $project: {
          productId: "$_id",
          productName: 1,
          quantitySold: 1,
          revenue: 1,
          orderCount: 1,
          slug: { $arrayElemAt: ["$product.slug", 0] },
          image: {
            $let: {
              vars: { media: { $arrayElemAt: ["$product.media", 0] } },
              in: { $arrayElemAt: ["$$media.url", 0] },
            },
          },
          categoryName: { $arrayElemAt: ["$product.category.name", 0] },
          currentStock: { $arrayElemAt: ["$product.inventorySummary.available", 0] },
          _id: 0,
        },
      },
    ]);

    return { rows, sortBy: sortField, from: from || null, to: to || null };
  }

  // Doanh thu chia theo danh mục.
  // Cần $lookup vì order item không snapshot category.
  async getRevenueByCategory({ from, to } = {}) {
    const match = this.buildMatchFilter({ from, to });

    const rows = await Order.aggregate([
      { $match: match },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            categoryId: "$product.category._id",
            categoryName: { $ifNull: ["$product.category.name", "Chưa phân loại"] },
          },
          revenue: { $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] } },
          quantitySold: { $sum: "$items.quantity" },
        },
      },
      {
        $project: {
          categoryId: "$_id.categoryId",
          categoryName: "$_id.categoryName",
          revenue: 1,
          quantitySold: 1,
          _id: 0,
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    return { rows, from: from || null, to: to || null };
  }

  // Doanh thu theo collection (bộ sưu tập). 1 sản phẩm có thể thuộc nhiều collection
  // → revenue được chia theo từng collection (1 đơn bán 1 sp trong 3 collection → cộng vào cả 3).
  async getRevenueByCollection({ from, to } = {}) {
    const match = this.buildMatchFilter({ from, to });

    const rows = await Order.aggregate([
      { $match: match },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$product.collections", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            collectionId: "$product.collections._id",
            collectionName: { $ifNull: ["$product.collections.name", "Không thuộc bộ sưu tập"] },
          },
          revenue: { $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] } },
          quantitySold: { $sum: "$items.quantity" },
        },
      },
      {
        $project: {
          collectionId: "$_id.collectionId",
          collectionName: "$_id.collectionName",
          revenue: 1,
          quantitySold: 1,
          _id: 0,
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    return { rows, from: from || null, to: to || null };
  }

  // Doanh thu theo thời gian — đường để vẽ chart.
  // granularity: day | week | month
  async getRevenueTimeSeries({ from, to, granularity = "day" } = {}) {
    const match = this.buildMatchFilter({ from, to });
    const dateFormat =
      granularity === "month"
        ? "%Y-%m"
        : granularity === "week"
          ? "%G-W%V"
          : "%Y-%m-%d";

    const rows = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
          revenue: { $sum: { $ifNull: ["$pricing.total", 0] } },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          period: "$_id",
          revenue: 1,
          orderCount: 1,
          _id: 0,
        },
      },
    ]);

    return { rows, granularity, from: from || null, to: to || null };
  }

  // KPI tổng quan cho dashboard
  async getOverview({ from, to } = {}) {
    const match = this.buildMatchFilter({ from, to });

    const [aggregate] = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          revenue: { $sum: { $ifNull: ["$pricing.total", 0] } },
          orderCount: { $sum: 1 },
          itemCount: { $sum: { $size: { $ifNull: ["$items", []] } } },
          uniqueCustomers: { $addToSet: "$userId" },
        },
      },
      {
        $project: {
          revenue: 1,
          orderCount: 1,
          itemCount: 1,
          uniqueCustomerCount: {
            $size: {
              $filter: {
                input: "$uniqueCustomers",
                as: "userId",
                cond: { $ne: ["$$userId", null] },
              },
            },
          },
          avgOrderValue: {
            $cond: [
              { $gt: ["$orderCount", 0] },
              { $divide: ["$revenue", "$orderCount"] },
              0,
            ],
          },
          _id: 0,
        },
      },
    ]);

    return aggregate || {
      revenue: 0,
      orderCount: 0,
      itemCount: 0,
      uniqueCustomerCount: 0,
      avgOrderValue: 0,
    };
  }
}

export default new ReportingService();
