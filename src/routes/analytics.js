import express from "express";
import { validateRequest } from "../middlewares/validation.js";
import {
  getAnalyticsEvents,
  trackAnalyticsEvent,
  getAnalyticsDashboard,
} from "../controllers/analyticsController.js";
import {
  analyticsEventsValidation,
  analyticsTrackValidation,
  analyticsDashboardValidation,
} from "../validations/analytics.js";

const router = express.Router();

// Get analytics events
router.get("/events", validateRequest(analyticsEventsValidation), getAnalyticsEvents);

// Track event
router.post("/track", validateRequest(analyticsTrackValidation), trackAnalyticsEvent);

// Get dashboard metrics
router.get(
  "/dashboard",
  validateRequest(analyticsDashboardValidation),
  getAnalyticsDashboard,
);

export default router;
