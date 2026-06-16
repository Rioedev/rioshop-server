import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  getTopProducts,
  getRevenueByCategory,
  getRevenueByCollection,
  getRevenueTimeSeries,
  getOverview,
  getPurchaseOrderOverview,
  getRevenueByFlashSale,
  exportSalesReportXlsx,
} from "../controllers/reportingController.js";

const router = express.Router();

// Toàn bộ báo cáo dành cho admin — chứa số liệu kinh doanh nhạy cảm (doanh thu, giá vốn, margin)
router.use(authenticateToken);

router.get("/overview", getOverview);
router.get("/top-products", getTopProducts);
router.get("/revenue-by-category", getRevenueByCategory);
router.get("/revenue-by-collection", getRevenueByCollection);
router.get("/revenue-by-flash-sale", getRevenueByFlashSale);
router.get("/revenue-timeseries", getRevenueTimeSeries);
router.get("/export-xlsx", exportSalesReportXlsx);
router.get("/purchase-orders/overview", getPurchaseOrderOverview);

export default router;
