import { asyncHandler, sendSuccess } from "../utils/helpers.js";
import analyticsService from "../services/analyticsService.js";

export const getAnalyticsEvents = asyncHandler(async (req, res) => {
  const events = await analyticsService.getEvents(
    {
      event: req.query.event,
      userId: req.query.userId,
      sessionId: req.query.sessionId,
      productId: req.query.productId,
      orderId: req.query.orderId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    },
    {
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 20),
    },
  );

  sendSuccess(res, 200, events, "Analytics events retrieved");
});

export const trackAnalyticsEvent = asyncHandler(async (req, res) => {
  const event = await analyticsService.trackEvent({
    ...req.body,
    ip: req.ip,
  });

  sendSuccess(res, 201, event, "Event tracked");
});

export const getAnalyticsDashboard = asyncHandler(async (req, res) => {
  const metrics = await analyticsService.getDashboardMetrics({
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  });

  sendSuccess(res, 200, metrics, "Dashboard metrics retrieved");
});
