import AnalyticsEvent from "../models/AnalyticsEvent.js";
import Order from "../models/Order.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_ORDER_STATUSES = ["pending", "confirmed", "packing", "ready_to_ship", "shipping"];
const COMPLETED_ORDER_STATUSES = ["delivered", "completed"];
const CANCELLED_ORDER_STATUSES = ["cancelled", "returned"];
const COD_PAYMENT_METHOD = "cod";
const NON_REPLACEMENT_ORDER_QUERY = { "exchangeMeta.isReplacement": { $ne: true } };
const NON_REPLACEMENT_ORDER_EXPR = { $ne: ["$exchangeMeta.isReplacement", true] };

const REVENUE_PAYMENT_CONDITION = {
  $and: [
    NON_REPLACEMENT_ORDER_EXPR,
    {
      $or: [
        { $eq: ["$paymentStatus", "paid"] },
        {
          $and: [
            { $eq: ["$paymentMethod", COD_PAYMENT_METHOD] },
            { $in: ["$status", COMPLETED_ORDER_STATUSES] },
          ],
        },
      ],
    },
  ],
};

const REVENUE_MATCH_CONDITION = {
  ...NON_REPLACEMENT_ORDER_QUERY,
  $or: [
    { paymentStatus: "paid" },
    {
      paymentMethod: COD_PAYMENT_METHOD,
      status: { $in: COMPLETED_ORDER_STATUSES },
    },
  ],
};

const toDateKey = (date) => date.toISOString().slice(0, 10);
const formatDateLabel = (dateKey) => {
  const parts = dateKey.split("-");
  if (parts.length !== 3) {
    return dateKey;
  }

  return `${parts[2]}/${parts[1]}`;
};

const buildDateKeys = (startDate, endDate) => {
  if (startDate.getTime() > endDate.getTime()) {
    return [];
  }

  const cursor = new Date(Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate(),
  ));
  const end = new Date(Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate(),
  ));

  const keys = [];
  while (cursor.getTime() <= end.getTime()) {
    keys.push(toDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return keys;
};

const safePercent = (numerator, denominator) => {
  if (!denominator || denominator <= 0) {
    return 0;
  }

  return Number(((numerator / denominator) * 100).toFixed(2));
};

export class AnalyticsService {
  async getEvents(filters = {}, options = {}) {
    const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
    const query = {};

    if (filters.event) query.event = filters.event;
    if (filters.userId) query.userId = filters.userId;
    if (filters.sessionId) query.sessionId = filters.sessionId;
    if (filters.productId) query.productId = filters.productId;
    if (filters.orderId) query.orderId = filters.orderId;

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    try {
      const skip = (page - 1) * limit;

      const [events, totalDocs] = await Promise.all([
        AnalyticsEvent.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate([
            { path: "userId", select: "_id fullName email" },
            { path: "productId", select: "_id name slug" },
            { path: "orderId", select: "_id orderNumber status pricing.total" },
          ]),
        AnalyticsEvent.countDocuments(query),
      ]);

      return {
        docs: events,
        totalDocs,
        limit,
        page,
        totalPages: Math.max(1, Math.ceil(totalDocs / limit)),
        hasPrevPage: page > 1,
        hasNextPage: skip + events.length < totalDocs,
      };
    } catch (error) {
      throw error;
    }
  }

  async trackEvent(data) {
    try {
      const payload = {
        ...data,
        createdAt: data.createdAt || new Date(),
      };

      const event = new AnalyticsEvent(payload);
      await event.save();

      return event;
    } catch (error) {
      throw error;
    }
  }

  async getDashboardMetrics(range = {}) {
    const now = new Date();
    const startDate = range.startDate
      ? new Date(range.startDate)
      : new Date(now.getTime() - 30 * DAY_MS);
    const endDate = range.endDate ? new Date(range.endDate) : now;
    const orderRangeMatch = {
      createdAt: { $gte: startDate, $lte: endDate },
    };
    const pendingOver24hCutoff = new Date(now.getTime() - DAY_MS);

    try {
      const [
        eventBreakdown,
        topProducts,
        orderMetrics,
        dailyOrderMetrics,
        paymentMethodMetrics,
        topProductsByRevenue,
        topCategoriesByRevenue,
        customerSegments,
        pendingOver24hOrders,
      ] = await Promise.all([
        AnalyticsEvent.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $group: {
              _id: "$event",
              count: { $sum: 1 },
            },
          },
          {
            $sort: { count: -1 },
          },
        ]),
        AnalyticsEvent.aggregate([
          {
            $match: {
              event: "product_view",
              createdAt: { $gte: startDate, $lte: endDate },
              productId: { $exists: true, $ne: null },
            },
          },
          {
            $group: {
              _id: "$productId",
              views: { $sum: 1 },
            },
          },
          {
            $sort: { views: -1 },
          },
          {
            $limit: 10,
          },
          {
            $lookup: {
              from: "products",
              localField: "_id",
              foreignField: "_id",
              as: "product",
            },
          },
          {
            $unwind: {
              path: "$product",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              _id: 1,
              views: 1,
              name: "$product.name",
              slug: "$product.slug",
            },
          },
        ]),
        Order.aggregate([
          {
            $match: orderRangeMatch,
          },
          {
            $facet: {
              totals: [
                {
                  $group: {
                  _id: null,
                  totalOrders: { $sum: 1 },
                  grossRevenue: {
                    $sum: {
                      $cond: [
                        NON_REPLACEMENT_ORDER_EXPR,
                        { $ifNull: ["$pricing.total", 0] },
                        0,
                      ],
                    },
                  },
                  netRevenue: {
                    $sum: {
                      $cond: [
                          { $in: ["$status", CANCELLED_ORDER_STATUSES] },
                          0,
                          {
                            $cond: [
                              REVENUE_PAYMENT_CONDITION,
                              { $ifNull: ["$pricing.total", 0] },
                              0,
                            ],
                          },
                        ],
                      },
                    },
                    recognizedRevenueOrders: {
                      $sum: {
                        $cond: [
                          { $in: ["$status", CANCELLED_ORDER_STATUSES] },
                          0,
                          {
                            $cond: [REVENUE_PAYMENT_CONDITION, 1, 0],
                          },
                        ],
                      },
                    },
                    cancelledOrders: {
                      $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
                    },
                    returnedOrders: {
                      $sum: { $cond: [{ $eq: ["$status", "returned"] }, 1, 0] },
                    },
                    nonCancelledOrders: {
                      $sum: {
                        $cond: [{ $in: ["$status", CANCELLED_ORDER_STATUSES] }, 0, 1],
                      },
                    },
                  },
                },
              ],
              byStatus: [
                {
                  $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                  },
                },
                {
                  $sort: { count: -1 },
                },
              ],
            },
          },
        ]),
        Order.aggregate([
          {
            $match: orderRangeMatch,
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$createdAt",
                },
              },
              revenue: {
                $sum: {
                  $cond: [
                    NON_REPLACEMENT_ORDER_EXPR,
                    { $ifNull: ["$pricing.total", 0] },
                    0,
                  ],
                },
              },
              recognizedRevenue: {
                $sum: {
                  $cond: [
                    { $in: ["$status", CANCELLED_ORDER_STATUSES] },
                    0,
                    {
                      $cond: [
                        REVENUE_PAYMENT_CONDITION,
                        { $ifNull: ["$pricing.total", 0] },
                        0,
                      ],
                    },
                  ],
                },
              },
              total: { $sum: 1 },
              pending: {
                $sum: {
                  $cond: [{ $in: ["$status", OPEN_ORDER_STATUSES] }, 1, 0],
                },
              },
              completed: {
                $sum: {
                  $cond: [{ $in: ["$status", COMPLETED_ORDER_STATUSES] }, 1, 0],
                },
              },
              cancelled: {
                $sum: {
                  $cond: [{ $in: ["$status", CANCELLED_ORDER_STATUSES] }, 1, 0],
                },
              },
            },
          },
          {
            $sort: { _id: 1 },
          },
        ]),
        Order.aggregate([
          {
            $match: orderRangeMatch,
          },
          {
            $group: {
              _id: { $ifNull: ["$paymentMethod", "unknown"] },
              count: { $sum: 1 },
              revenue: {
                $sum: {
                  $cond: [
                    { $in: ["$status", CANCELLED_ORDER_STATUSES] },
                    0,
                    {
                      $cond: [
                        REVENUE_PAYMENT_CONDITION,
                        { $ifNull: ["$pricing.total", 0] },
                        0,
                      ],
                    },
                  ],
                },
              },
            },
          },
          {
            $sort: { count: -1 },
          },
        ]),
        Order.aggregate([
          {
            $match: {
              ...orderRangeMatch,
              status: { $nin: CANCELLED_ORDER_STATUSES },
              ...REVENUE_MATCH_CONDITION,
            },
          },
          {
            $unwind: "$items",
          },
          {
            $match: {
              "items.productId": { $exists: true, $ne: null },
            },
          },
          {
            $group: {
              _id: "$items.productId",
              fallbackName: { $first: "$items.productName" },
              revenue: { $sum: { $ifNull: ["$items.totalPrice", 0] } },
              quantity: { $sum: { $ifNull: ["$items.quantity", 0] } },
              orderIds: { $addToSet: "$_id" },
            },
          },
          {
            $lookup: {
              from: "products",
              localField: "_id",
              foreignField: "_id",
              as: "product",
            },
          },
          {
            $unwind: {
              path: "$product",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              _id: 0,
              productId: "$_id",
              name: { $ifNull: ["$product.name", "$fallbackName"] },
              slug: "$product.slug",
              revenue: 1,
              quantity: 1,
              orders: { $size: "$orderIds" },
            },
          },
          {
            $sort: { revenue: -1 },
          },
          {
            $limit: 10,
          },
        ]),
        Order.aggregate([
          {
            $match: {
              ...orderRangeMatch,
              status: { $nin: CANCELLED_ORDER_STATUSES },
              ...REVENUE_MATCH_CONDITION,
            },
          },
          {
            $unwind: "$items",
          },
          {
            $lookup: {
              from: "products",
              localField: "items.productId",
              foreignField: "_id",
              as: "product",
            },
          },
          {
            $unwind: {
              path: "$product",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $addFields: {
              categoryId: {
                $ifNull: [{ $toString: "$product.category._id" }, "uncategorized"],
              },
              categoryName: {
                $ifNull: ["$product.category.name", "Khong phan loai"],
              },
              lineRevenue: { $ifNull: ["$items.totalPrice", 0] },
              lineQuantity: { $ifNull: ["$items.quantity", 0] },
            },
          },
          {
            $group: {
              _id: {
                categoryId: "$categoryId",
                categoryName: "$categoryName",
              },
              revenue: { $sum: "$lineRevenue" },
              quantity: { $sum: "$lineQuantity" },
              orderIds: { $addToSet: "$_id" },
            },
          },
          {
            $project: {
              _id: 0,
              categoryId: "$_id.categoryId",
              name: "$_id.categoryName",
              revenue: 1,
              quantity: 1,
              orders: { $size: "$orderIds" },
            },
          },
          {
            $sort: { revenue: -1 },
          },
          {
            $limit: 8,
          },
        ]),
        Order.aggregate([
          {
            $match: {
              ...orderRangeMatch,
              userId: { $exists: true, $ne: null },
            },
          },
          {
            $group: {
              _id: "$userId",
            },
          },
          {
            $lookup: {
              from: "orders",
              let: { customerId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$userId", "$$customerId"] },
                        { $lt: ["$createdAt", startDate] },
                      ],
                    },
                  },
                },
                {
                  $limit: 1,
                },
              ],
              as: "beforeRange",
            },
          },
          {
            $group: {
              _id: null,
              newCustomers: {
                $sum: {
                  $cond: [{ $eq: [{ $size: "$beforeRange" }, 0] }, 1, 0],
                },
              },
              returningCustomers: {
                $sum: {
                  $cond: [{ $gt: [{ $size: "$beforeRange" }, 0] }, 1, 0],
                },
              },
            },
          },
        ]),
        Order.countDocuments({
          status: { $in: OPEN_ORDER_STATUSES },
          createdAt: { $lte: pendingOver24hCutoff },
        }),
      ]);

      const eventsByType = eventBreakdown.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});

      const totalEvents = eventBreakdown.reduce((sum, item) => sum + item.count, 0);
      const purchaseCount = Number(eventsByType.purchase || 0);
      const pageViewCount = Number(eventsByType.page_view || 0);
      const productViewCount = Number(eventsByType.product_view || 0);
      const addToCartCount = Number(eventsByType.add_to_cart || 0);

      const orderInfo = orderMetrics[0] || {};
      const totals = orderInfo.totals?.[0] || {
        totalOrders: 0,
        grossRevenue: 0,
        netRevenue: 0,
        recognizedRevenueOrders: 0,
        cancelledOrders: 0,
        returnedOrders: 0,
        nonCancelledOrders: 0,
      };
      const ordersByStatus = (orderInfo.byStatus || []).reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});
      const statusBreakdown = (orderInfo.byStatus || []).map((item) => ({
        status: item._id,
        count: Number(item.count || 0),
      }));

      const dateKeys = buildDateKeys(startDate, endDate);
      const dailyMetricMap = new Map(
        (dailyOrderMetrics || []).map((item) => [item._id, item]),
      );

      const revenueByDate = dateKeys.map((dateKey) => {
        const row = dailyMetricMap.get(dateKey);
        return {
          date: dateKey,
          label: formatDateLabel(dateKey),
          revenue: Number(row?.recognizedRevenue || 0),
          orders: Number(row?.total || 0),
        };
      });

      const ordersByDate = dateKeys.map((dateKey) => {
        const row = dailyMetricMap.get(dateKey);
        return {
          date: dateKey,
          label: formatDateLabel(dateKey),
          total: Number(row?.total || 0),
          pending: Number(row?.pending || 0),
          completed: Number(row?.completed || 0),
          cancelled: Number(row?.cancelled || 0),
        };
      });

      const paymentMethods = (paymentMethodMetrics || []).map((item) => ({
        method: item._id || "unknown",
        count: Number(item.count || 0),
        revenue: Number(item.revenue || 0),
      }));

      const customerSegment = customerSegments?.[0] || {
        newCustomers: 0,
        returningCustomers: 0,
      };

      const safeTotalOrders = Number(totals.totalOrders || 0);
      const safeGrossRevenue = Number(totals.grossRevenue || 0);
      const safeNetRevenue = Number(totals.netRevenue || 0);
      const safeRecognizedRevenueOrders = Number(totals.recognizedRevenueOrders || 0);
      const safeNonCancelledOrders = Number(totals.nonCancelledOrders || 0);
      const safeCancelledOrders = Number(totals.cancelledOrders || 0);
      const safeReturnedOrders = Number(totals.returnedOrders || 0);

      return {
        range: { startDate, endDate },
        totals: {
          events: totalEvents,
          orders: safeTotalOrders,
          revenue: safeGrossRevenue,
          grossRevenue: safeGrossRevenue,
          netRevenue: safeNetRevenue,
        },
        summary: {
          averageOrderValue:
            safeRecognizedRevenueOrders > 0
              ? Number((safeNetRevenue / safeRecognizedRevenueOrders).toFixed(2))
              : 0,
          cancellationRate: safePercent(safeCancelledOrders, safeTotalOrders),
          returnRate: safePercent(safeReturnedOrders, safeTotalOrders),
          pendingOver24hOrders: Number(pendingOver24hOrders || 0),
          newCustomers: Number(customerSegment.newCustomers || 0),
          returningCustomers: Number(customerSegment.returningCustomers || 0),
        },
        eventsByType,
        ordersByStatus,
        statusBreakdown,
        paymentMethods,
        revenueByDate,
        ordersByDate,
        topProducts,
        topProductsByRevenue,
        topCategoriesByRevenue,
        conversion: {
          purchases: purchaseCount,
          pageViews: pageViewCount,
          productViews: productViewCount,
          addToCarts: addToCartCount,
          addToCartRate: safePercent(addToCartCount, productViewCount),
          purchaseToViewRate: safePercent(purchaseCount, pageViewCount),
          cartToPurchaseRate: safePercent(purchaseCount, addToCartCount),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async getEventCountsByDate(range = {}) {
    const now = new Date();
    const startDate = range.startDate
      ? new Date(range.startDate)
      : new Date(now.getTime() - 7 * DAY_MS);
    const endDate = range.endDate ? new Date(range.endDate) : now;

    try {
      const counts = await AnalyticsEvent.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              date: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              event: "$event",
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { "_id.date": 1 },
        },
      ]);

      return counts;
    } catch (error) {
      throw error;
    }
  }
}

export default new AnalyticsService();
