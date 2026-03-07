import express from "express";
import { asyncHandler, sendSuccess } from "../utils/helpers.js";

const router = express.Router();

// Get analytics events
router.get(
  "/events",
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, { events: [] }, "Analytics events retrieved");
  }),
);

// Track event
router.post(
  "/track",
  asyncHandler(async (req, res) => {
    sendSuccess(res, 201, {}, "Event tracked");
  }),
);

// Get dashboard metrics
router.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Dashboard metrics retrieved");
  }),
);

export default router;
