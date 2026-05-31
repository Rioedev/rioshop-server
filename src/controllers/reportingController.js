import { asyncHandler, sendSuccess } from "../utils/helpers.js";
import reportingService from "../services/reportingService.js";

export const getTopProducts = asyncHandler(async (req, res) => {
  const { from, to, limit, sortBy } = req.query;
  const data = await reportingService.getTopProducts({ from, to, limit, sortBy });
  sendSuccess(res, 200, data, "OK");
});

export const getRevenueByCategory = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await reportingService.getRevenueByCategory({ from, to });
  sendSuccess(res, 200, data, "OK");
});

export const getRevenueByCollection = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await reportingService.getRevenueByCollection({ from, to });
  sendSuccess(res, 200, data, "OK");
});

export const getRevenueTimeSeries = asyncHandler(async (req, res) => {
  const { from, to, granularity } = req.query;
  const data = await reportingService.getRevenueTimeSeries({ from, to, granularity });
  sendSuccess(res, 200, data, "OK");
});

export const getOverview = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await reportingService.getOverview({ from, to });
  sendSuccess(res, 200, data, "OK");
});
