import AnalyticsEvent from "../models/AnalyticsEvent.js";
import Order from "../models/Order.js";

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
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const endDate = range.endDate ? new Date(range.endDate) : now;

    try {
      const [eventBreakdown, topProducts, orderMetrics] = await Promise.all([
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
            $match: {
              createdAt: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $facet: {
              totals: [
                {
                  $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: "$pricing.total" },
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
              ],
            },
          },
        ]),
      ]);

      const eventsByType = eventBreakdown.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});

      const totalEvents = eventBreakdown.reduce(
        (sum, item) => sum + item.count,
        0,
      );
      const purchaseCount = eventsByType.purchase || 0;
      const pageViewCount = eventsByType.page_view || 0;

      const orderInfo = orderMetrics[0] || {};
      const totals = orderInfo.totals?.[0] || {
        totalOrders: 0,
        totalRevenue: 0,
      };
      const ordersByStatus = (orderInfo.byStatus || []).reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});

      return {
        range: { startDate, endDate },
        totals: {
          events: totalEvents,
          orders: totals.totalOrders || 0,
          revenue: totals.totalRevenue || 0,
        },
        eventsByType,
        ordersByStatus,
        topProducts,
        conversion: {
          purchases: purchaseCount,
          pageViews: pageViewCount,
          purchaseToViewRate:
            pageViewCount > 0
              ? Number(((purchaseCount / pageViewCount) * 100).toFixed(2))
              : 0,
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
      : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
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
