import Order from "../models/Order.js";
import FlashSale from "../models/FlashSale.js";

// Báo cáo bán hàng — đọc thẳng Order, không nhân bản số.
// Quy ước revenue:
//   - Chỉ tính các đơn KHÔNG ở trạng thái cancelled/returned
//   - Doanh thu / item = phân bổ subtotal sau coupon theo từng dòng hàng, không gồm shipping.
//   - Quantity sold = sum(item.quantity)
//
// Helper chung: filter ngày + status. Tham số `from`/`to` (ISO date) tùy chọn.

const COMPLETED_ORDER_STATUSES = ["delivered", "completed"];
const NON_REPLACEMENT_ORDER_QUERY = { "exchangeMeta.isReplacement": { $ne: true } };

const merchandiseDiscountExpression = {
  $cond: [
    { $eq: ["$couponType", "free_ship"] },
    0,
    {
      $min: [
        { $ifNull: ["$pricing.discount", 0] },
        { $ifNull: ["$pricing.subtotal", 0] },
      ],
    },
  ],
};

const discountedSubtotalExpression = {
  $cond: [
    { $gt: [{ $ifNull: ["$pricing.subtotal", 0] }, 0] },
    {
      $cond: [
        {
          $gt: [
            {
              $subtract: [
                { $ifNull: ["$pricing.subtotal", 0] },
                merchandiseDiscountExpression,
              ],
            },
            0,
          ],
        },
        {
          $subtract: [
            { $ifNull: ["$pricing.subtotal", 0] },
            merchandiseDiscountExpression,
          ],
        },
        0,
      ],
    },
    0,
  ],
};

const lineGrossExpression = {
  $ifNull: [
    "$items.totalPrice",
    {
      $multiply: [
        { $ifNull: ["$items.unitPrice", 0] },
        { $ifNull: ["$items.quantity", 0] },
      ],
    },
  ],
};

const lineRevenueExpression = {
  $cond: [
    { $gt: [{ $ifNull: ["$pricing.subtotal", 0] }, 0] },
    {
      $multiply: [
        lineGrossExpression,
        {
          $divide: [
            discountedSubtotalExpression,
            { $ifNull: ["$pricing.subtotal", 0] },
          ],
        },
      ],
    },
    lineGrossExpression,
  ],
};

const lineCostExpression = {
  $multiply: [
    {
      $ifNull: [
        "$items.costPriceSnapshot",
        { $ifNull: ["$product.pricing.costPrice", 0] },
      ],
    },
    { $ifNull: ["$items.quantity", 0] },
  ],
};

const hasTrackedShippingFeeExpression = {
  $in: ["$pricing.shippingFeeStatus", ["estimated", "confirmed"]],
};

const shippingQuotedFeeExpression = {
  $cond: [
    hasTrackedShippingFeeExpression,
    { $ifNull: ["$pricing.shippingQuotedFee", 0] },
    0,
  ],
};

const shippingCarrierFeeExpression = {
  $cond: [
    hasTrackedShippingFeeExpression,
    { $ifNull: ["$pricing.shippingCarrierFee", 0] },
    0,
  ],
};

const shippingCustomerPaidExpression = {
  $cond: [
    hasTrackedShippingFeeExpression,
    { $ifNull: ["$pricing.shippingCustomerPaid", 0] },
    0,
  ],
};

const shippingSubsidyExpression = {
  $cond: [
    hasTrackedShippingFeeExpression,
    { $ifNull: ["$pricing.shippingSubsidy", 0] },
    0,
  ],
};

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizePagination = (page, limit, maxLimit = 100) => {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.max(1, Math.min(maxLimit, Number.parseInt(limit, 10) || 10));
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
};

const buildPagination = ({ rows = [], totalDocs = 0, page, limit }) => ({
  rows,
  totalDocs,
  page,
  limit,
  totalPages: Math.max(1, Math.ceil(totalDocs / limit)),
  hasPrevPage: page > 1,
  hasNextPage: page * limit < totalDocs,
});

class ReportingService {
  buildMatchFilter({ from, to } = {}) {
    const match = {
      status: { $nin: ["cancelled", "returned"] },
      ...NON_REPLACEMENT_ORDER_QUERY,
      $or: [
        { paymentStatus: "paid" },
        {
          paymentMethod: "cod",
          status: { $in: COMPLETED_ORDER_STATUSES },
        },
      ],
    };
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to);
    }
    return match;
  }

  // Top N sản phẩm bán chạy nhất theo doanh thu, số lượng hoặc lãi gộp.
  // Lãi gộp = revenue − costPriceSnapshot × quantity. Đơn cũ chưa có snapshot
  // fallback về costPrice hiện tại để vẫn có số liệu.
  async getTopProducts({ from, to, page = 1, limit = 10, sortBy = "revenue", search = "" } = {}) {
    const match = this.buildMatchFilter({ from, to });
    const pagination = normalizePagination(page, limit, 10000);
    const sortField =
      sortBy === "quantity"
        ? "quantitySold"
        : sortBy === "grossProfit"
          ? "grossProfit"
          : "revenue";

    const pipeline = [
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
        $addFields: {
          lineRevenue: lineRevenueExpression,
          lineCost: lineCostExpression,
        },
      },
      {
        $group: {
          _id: "$items.productId",
          productName: { $first: "$items.productName" },
          quantitySold: { $sum: "$items.quantity" },
          revenue: { $sum: "$lineRevenue" },
          cost: { $sum: "$lineCost" },
          orderIds: { $addToSet: "$_id" },
          slug: { $first: "$product.slug" },
          firstMediaUrl: { $first: { $arrayElemAt: ["$product.media.url", 0] } },
          categoryName: { $first: "$product.category.name" },
          currentStock: { $first: "$product.inventorySummary.available" },
        },
      },
      {
        $addFields: {
          grossProfit: { $subtract: ["$revenue", "$cost"] },
          marginRate: {
            $cond: [
              { $gt: ["$revenue", 0] },
              { $divide: [{ $subtract: ["$revenue", "$cost"] }, "$revenue"] },
              0,
            ],
          },
          orderCount: { $size: "$orderIds" },
        },
      },
      ...(search
        ? [{ $match: { productName: { $regex: escapeRegex(search), $options: "i" } } }]
        : []),
      { $sort: { [sortField]: -1, productName: 1 } },
      {
        $project: {
          productId: "$_id",
          productName: 1,
          slug: 1,
          image: "$firstMediaUrl",
          categoryName: 1,
          currentStock: 1,
          quantitySold: 1,
          revenue: 1,
          cost: 1,
          grossProfit: 1,
          marginRate: 1,
          orderCount: 1,
          _id: 0,
        },
      },
    ];

    const [result] = await Order.aggregate([
      ...pipeline,
      {
        $facet: {
          rows: [{ $skip: pagination.skip }, { $limit: pagination.limit }],
          metadata: [{ $count: "totalDocs" }],
        },
      },
    ]);

    const totalDocs = Number(result?.metadata?.[0]?.totalDocs || 0);

    return {
      ...buildPagination({ rows: result?.rows || [], totalDocs, ...pagination }),
      sortBy: sortField,
      from: from || null,
      to: to || null,
    };
  }

  async getRevenueByFlashSale({ from, to, page = 1, limit = 10, sortBy = "revenue" } = {}) {
    const orderMatch = this.buildMatchFilter({ from, to });
    const pagination = normalizePagination(page, limit, 10000);
    const flashSaleMatch = {};
    if (from) flashSaleMatch.endsAt = { $gte: new Date(from) };
    if (to) flashSaleMatch.startsAt = { $lte: new Date(to) };
    const sortField = sortBy === "quantity" ? "quantitySold" : sortBy === "grossProfit" ? "grossProfit" : "revenue";

    const [result] = await FlashSale.aggregate([
      { $match: flashSaleMatch },
      {
        $lookup: {
          from: "orders",
          let: { flashSaleId: "$_id" },
          pipeline: [
            { $match: orderMatch },
            { $unwind: "$items" },
            {
              $match: {
                "items.priceSource": "flash_sale",
                $expr: { $eq: ["$items.flashSaleId", "$$flashSaleId"] },
              },
            },
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
              $addFields: {
                lineRevenue: lineRevenueExpression,
                lineCost: lineCostExpression,
                lineDiscount: {
                  $multiply: [
                    {
                      $cond: [
                        { $gt: [{ $ifNull: ["$items.listPrice", 0] }, { $ifNull: ["$items.unitPrice", 0] }] },
                        { $subtract: [{ $ifNull: ["$items.listPrice", 0] }, { $ifNull: ["$items.unitPrice", 0] }] },
                        0,
                      ],
                    },
                    { $ifNull: ["$items.quantity", 0] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                revenue: { $sum: "$lineRevenue" },
                cost: { $sum: "$lineCost" },
                discountAmount: { $sum: "$lineDiscount" },
                quantitySold: { $sum: "$items.quantity" },
                orderIds: { $addToSet: "$_id" },
                productIds: { $addToSet: "$items.productId" },
              },
            },
          ],
          as: "salesMetrics",
        },
      },
      { $addFields: { metrics: { $arrayElemAt: ["$salesMetrics", 0] } } },
      {
        $project: {
          flashSaleId: "$_id",
          name: 1,
          banner: 1,
          startsAt: 1,
          endsAt: 1,
          isActive: 1,
          slotCount: { $size: { $ifNull: ["$slots", []] } },
          stockLimit: { $sum: { $ifNull: ["$slots.stockLimit", []] } },
          recordedSold: { $sum: { $ifNull: ["$slots.sold", []] } },
          revenue: { $ifNull: ["$metrics.revenue", 0] },
          cost: { $ifNull: ["$metrics.cost", 0] },
          discountAmount: { $ifNull: ["$metrics.discountAmount", 0] },
          quantitySold: { $ifNull: ["$metrics.quantitySold", 0] },
          orderCount: { $size: { $ifNull: ["$metrics.orderIds", []] } },
          productCount: { $size: { $ifNull: ["$metrics.productIds", []] } },
          _id: 0,
        },
      },
      {
        $addFields: {
          grossProfit: { $subtract: ["$revenue", "$cost"] },
          marginRate: {
            $cond: [
              { $gt: ["$revenue", 0] },
              { $divide: [{ $subtract: ["$revenue", "$cost"] }, "$revenue"] },
              0,
            ],
          },
        },
      },
      { $sort: { [sortField]: -1, startsAt: -1 } },
      {
        $facet: {
          rows: [{ $skip: pagination.skip }, { $limit: pagination.limit }],
          metadata: [{ $count: "totalDocs" }],
        },
      },
    ]);

    const totalDocs = Number(result?.metadata?.[0]?.totalDocs || 0);
    return {
      ...buildPagination({ rows: result?.rows || [], totalDocs, ...pagination }),
      sortBy: sortField,
      from: from || null,
      to: to || null,
    };
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
          revenue: { $sum: lineRevenueExpression },
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
          revenue: { $sum: lineRevenueExpression },
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
  // granularity: day | week | month | quarter
  async getRevenueTimeSeries({ from, to, granularity = "day" } = {}) {
    const match = this.buildMatchFilter({ from, to });
    const dateFormat =
      granularity === "quarter"
        ? "%Y-Q"
        : granularity === "month"
        ? "%Y-%m"
        : granularity === "week"
          ? "%G-W%V"
          : "%Y-%m-%d";

    const baseRows = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: granularity === "quarter"
            ? {
                year: { $year: "$createdAt" },
                quarter: { $ceil: { $divide: [{ $month: "$createdAt" }, 3] } },
              }
            : { $dateToString: { format: dateFormat, date: "$createdAt" } },
          revenue: { $sum: discountedSubtotalExpression },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const rows = baseRows.map((row) => ({
      period: granularity === "quarter" ? `${row._id.year}-Q${row._id.quarter}` : row._id,
      revenue: Number(row.revenue || 0),
      orderCount: Number(row.orderCount || 0),
    }));

    return { rows, granularity, from: from || null, to: to || null };
  }

  // KPI tổng quan cho dashboard — kèm tổng giá vốn + lãi gộp.
  async getOverview({ from, to } = {}) {
    const match = this.buildMatchFilter({ from, to });

    const [aggregate] = await Order.aggregate([
      { $match: match },
      {
        $facet: {
          orderTotals: [
            {
              $group: {
                _id: null,
                orderCount: { $sum: 1 },
                itemCount: { $sum: { $size: { $ifNull: ["$items", []] } } },
                uniqueCustomers: { $addToSet: "$userId" },
                shippingQuotedFee: { $sum: shippingQuotedFeeExpression },
                shippingCarrierFee: { $sum: shippingCarrierFeeExpression },
                shippingCustomerPaid: { $sum: shippingCustomerPaidExpression },
                shippingSubsidy: { $sum: shippingSubsidyExpression },
                shippingTrackedOrderCount: {
                  $sum: { $cond: [hasTrackedShippingFeeExpression, 1, 0] },
                },
              },
            },
          ],
          costTotals: [
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
                _id: null,
                cost: {
                  $sum: lineCostExpression,
                },
                revenue: { $sum: lineRevenueExpression },
              },
            },
          ],
        },
      },
      {
        $project: {
          revenue: { $ifNull: [{ $arrayElemAt: ["$costTotals.revenue", 0] }, 0] },
          orderCount: { $ifNull: [{ $arrayElemAt: ["$orderTotals.orderCount", 0] }, 0] },
          itemCount: { $ifNull: [{ $arrayElemAt: ["$orderTotals.itemCount", 0] }, 0] },
          uniqueCustomerCount: {
            $size: {
              $filter: {
                input: { $ifNull: [{ $arrayElemAt: ["$orderTotals.uniqueCustomers", 0] }, []] },
                as: "userId",
                cond: { $ne: ["$$userId", null] },
              },
            },
          },
          cost: { $ifNull: [{ $arrayElemAt: ["$costTotals.cost", 0] }, 0] },
          shippingQuotedFee: {
            $ifNull: [{ $arrayElemAt: ["$orderTotals.shippingQuotedFee", 0] }, 0],
          },
          shippingCarrierFee: {
            $ifNull: [{ $arrayElemAt: ["$orderTotals.shippingCarrierFee", 0] }, 0],
          },
          shippingCustomerPaid: {
            $ifNull: [{ $arrayElemAt: ["$orderTotals.shippingCustomerPaid", 0] }, 0],
          },
          shippingSubsidy: {
            $ifNull: [{ $arrayElemAt: ["$orderTotals.shippingSubsidy", 0] }, 0],
          },
          shippingTrackedOrderCount: {
            $ifNull: [{ $arrayElemAt: ["$orderTotals.shippingTrackedOrderCount", 0] }, 0],
          },
        },
      },
      {
        $addFields: {
          grossProfit: { $subtract: ["$revenue", "$cost"] },
          profitAfterShipping: {
            $subtract: [
              { $add: [{ $subtract: ["$revenue", "$cost"] }, "$shippingCustomerPaid"] },
              "$shippingCarrierFee",
            ],
          },
          shippingNetCost: {
            $subtract: ["$shippingCarrierFee", "$shippingCustomerPaid"],
          },
          shippingUntrackedOrderCount: {
            $subtract: ["$orderCount", "$shippingTrackedOrderCount"],
          },
          marginRate: {
            $cond: [
              { $gt: ["$revenue", 0] },
              { $divide: [{ $subtract: ["$revenue", "$cost"] }, "$revenue"] },
              0,
            ],
          },
          avgOrderValue: {
            $cond: [
              { $gt: ["$orderCount", 0] },
              { $divide: ["$revenue", "$orderCount"] },
              0,
            ],
          },
          profitAfterShippingMarginRate: {
            $cond: [
              { $gt: [{ $add: ["$revenue", "$shippingCustomerPaid"] }, 0] },
              {
                $divide: [
                  {
                    $subtract: [
                      {
                        $add: [
                          { $subtract: ["$revenue", "$cost"] },
                          "$shippingCustomerPaid",
                        ],
                      },
                      "$shippingCarrierFee",
                    ],
                  },
                  { $add: ["$revenue", "$shippingCustomerPaid"] },
                ],
              },
              0,
            ],
          },
        },
      },
    ]);

    return aggregate || {
      revenue: 0,
      orderCount: 0,
      itemCount: 0,
      uniqueCustomerCount: 0,
      avgOrderValue: 0,
      cost: 0,
      grossProfit: 0,
      marginRate: 0,
      shippingQuotedFee: 0,
      shippingCarrierFee: 0,
      shippingCustomerPaid: 0,
      shippingSubsidy: 0,
      shippingNetCost: 0,
      shippingTrackedOrderCount: 0,
      shippingUntrackedOrderCount: 0,
      profitAfterShipping: 0,
      profitAfterShippingMarginRate: 0,
    };
  }

  // Tổng quan PO — tổng đặt, đã nhận, đang chờ, hủy.
  async getPurchaseOrderOverview({ from, to } = {}) {
    const PurchaseOrder = (await import("../models/PurchaseOrder.js")).default;
    const match = {};
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to);
    }

    const rows = await PurchaseOrder.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: { $ifNull: ["$total", 0] } },
        },
      },
    ]);

    const result = {
      draft: { count: 0, total: 0 },
      ordered: { count: 0, total: 0 },
      partially_received: { count: 0, total: 0 },
      received: { count: 0, total: 0 },
      cancelled: { count: 0, total: 0 },
      closed: { count: 0, total: 0 },
    };
    rows.forEach((row) => {
      result[row._id] = { count: row.count, total: row.total };
    });
    return result;
  }
}

export default new ReportingService();
