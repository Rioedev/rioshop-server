import express from "express";
import {
  getTopProducts,
  getRevenueByCategory,
  getRevenueByCollection,
  getRevenueTimeSeries,
  getOverview,
} from "../controllers/reportingController.js";

const router = express.Router();

router.get("/overview", getOverview);
router.get("/top-products", getTopProducts);
router.get("/revenue-by-category", getRevenueByCategory);
router.get("/revenue-by-collection", getRevenueByCollection);
router.get("/revenue-timeseries", getRevenueTimeSeries);

export default router;
