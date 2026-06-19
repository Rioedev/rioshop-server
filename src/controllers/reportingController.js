import { asyncHandler, sendSuccess } from "../utils/helpers.js";
import reportingService from "../services/reportingService.js";
import ExcelJS from "exceljs";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const EXPORT_GRANULARITIES = new Set(["day", "week", "month", "quarter"]);

const formatDate = (value) => {
  if (!value) return "Toàn bộ thời gian";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("vi-VN");
};

const styleWorksheet = (sheet, currencyColumns = []) => {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: `${sheet.getColumn(sheet.columnCount).letter}1` };
  const header = sheet.getRow(1);
  header.height = 24;
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1559B7" } };
  header.alignment = { vertical: "middle", horizontal: "center" };
  currencyColumns.forEach((key) => {
    sheet.getColumn(key).numFmt = "#,##0 [$₫-vi-VN]";
  });
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) row.alignment = { vertical: "middle" };
  });
};

const addReportSheet = (workbook, name, columns, rows, currencyColumns = []) => {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns;
  sheet.addRows(rows);
  styleWorksheet(sheet, currencyColumns);
  return sheet;
};

export const getTopProducts = asyncHandler(async (req, res) => {
  const { from, to, page, limit, sortBy, search } = req.query;
  const data = await reportingService.getTopProducts({ from, to, page, limit, sortBy, search });
  sendSuccess(res, 200, data, "OK");
});

export const getRevenueByFlashSale = asyncHandler(async (req, res) => {
  const { from, to, page, limit, sortBy } = req.query;
  const data = await reportingService.getRevenueByFlashSale({ from, to, page, limit, sortBy });
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

export const getPurchaseOrderOverview = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await reportingService.getPurchaseOrderOverview({ from, to });
  sendSuccess(res, 200, data, "OK");
});

export const exportSalesReportXlsx = asyncHandler(async (req, res) => {
  const { from, to, allTime } = req.query;
  const period = allTime === "true" ? {} : { from, to };
  const granularity = EXPORT_GRANULARITIES.has(req.query.granularity)
    ? req.query.granularity
    : "month";

  const [overview, timeSeries, products, flashSales, categories, collections] = await Promise.all([
    reportingService.getOverview(period),
    reportingService.getRevenueTimeSeries({ ...period, granularity }),
    reportingService.getTopProducts({ ...period, page: 1, limit: 10000, sortBy: "revenue" }),
    reportingService.getRevenueByFlashSale({ ...period, page: 1, limit: 10000, sortBy: "revenue" }),
    reportingService.getRevenueByCategory(period),
    reportingService.getRevenueByCollection(period),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RioShop";
  workbook.created = new Date();
  workbook.properties.date1904 = false;

  const summary = workbook.addWorksheet("Tổng quan");
  summary.columns = [
    { header: "Chỉ số", key: "metric", width: 34 },
    { header: "Giá trị", key: "value", width: 24 },
  ];
  summary.addRows([
    { metric: "Từ ngày", value: period.from ? formatDate(period.from) : "Toàn bộ thời gian" },
    { metric: "Đến ngày", value: period.to ? formatDate(period.to) : "Toàn bộ thời gian" },
    { metric: "Doanh thu thuần hàng hóa", value: overview.revenue },
    { metric: "Số đơn ghi nhận doanh thu", value: overview.orderCount },
    { metric: "Số dòng sản phẩm", value: overview.itemCount },
    { metric: "Số khách hàng", value: overview.uniqueCustomerCount },
    { metric: "Giá vốn ước tính", value: overview.cost },
    { metric: "Lãi gộp ước tính", value: overview.grossProfit },
    { metric: "Tỷ suất lãi gộp", value: overview.marginRate },
    { metric: "Phí vận chuyển khách trả", value: overview.shippingCustomerPaid },
    { metric: "Phí hãng vận chuyển", value: overview.shippingCarrierFee },
    { metric: "Chi phí ship cửa hàng chịu", value: overview.shippingNetCost },
    { metric: "Lợi nhuận sau phí ship", value: overview.profitAfterShipping },
    { metric: "Tỷ suất lợi nhuận sau phí ship", value: overview.profitAfterShippingMarginRate },
    { metric: "Số đơn cũ chưa có phí hãng", value: overview.shippingUntrackedOrderCount },
    { metric: "Giá trị trung bình mỗi đơn", value: overview.avgOrderValue },
  ]);
  styleWorksheet(summary);
  ["B4", "B8", "B9", "B11", "B12", "B13", "B14", "B17"].forEach((cell) => {
    summary.getCell(cell).numFmt = "#,##0 [$₫-vi-VN]";
  });
  summary.getCell("B10").numFmt = "0.00%";
  summary.getCell("B15").numFmt = "0.00%";

  addReportSheet(
    workbook,
    "Doanh thu theo kỳ",
    [
      { header: "Kỳ", key: "period", width: 20 },
      { header: "Doanh thu", key: "revenue", width: 20 },
      { header: "Số đơn", key: "orderCount", width: 14 },
    ],
    timeSeries.rows,
    ["B"],
  );

  addReportSheet(
    workbook,
    "Theo sản phẩm",
    [
      { header: "Sản phẩm", key: "productName", width: 42 },
      { header: "Danh mục", key: "categoryName", width: 24 },
      { header: "Số lượng bán", key: "quantitySold", width: 16 },
      { header: "Doanh thu", key: "revenue", width: 20 },
      { header: "Giá vốn", key: "cost", width: 20 },
      { header: "Lãi gộp", key: "grossProfit", width: 20 },
      { header: "Tỷ suất lãi gộp", key: "marginRate", width: 18 },
      { header: "Số đơn", key: "orderCount", width: 14 },
      { header: "Tồn kho hiện tại", key: "currentStock", width: 18 },
    ],
    products.rows,
    ["D", "E", "F"],
  ).getColumn("G").numFmt = "0.00%";

  const flashSaleSheet = addReportSheet(
    workbook,
    "Theo Flash Sale",
    [
      { header: "Chương trình", key: "name", width: 38 },
      { header: "Bắt đầu", key: "startsAt", width: 20 },
      { header: "Kết thúc", key: "endsAt", width: 20 },
      { header: "Số sản phẩm", key: "productCount", width: 16 },
      { header: "Số lượng bán", key: "quantitySold", width: 16 },
      { header: "Số đơn", key: "orderCount", width: 14 },
      { header: "Doanh thu", key: "revenue", width: 20 },
      { header: "Giảm trực tiếp", key: "discountAmount", width: 20 },
      { header: "Giá vốn", key: "cost", width: 20 },
      { header: "Lãi gộp", key: "grossProfit", width: 20 },
      { header: "Tỷ suất lãi gộp", key: "marginRate", width: 18 },
    ],
    flashSales.rows.map((row) => ({
      ...row,
      startsAt: row.startsAt ? new Date(row.startsAt) : null,
      endsAt: row.endsAt ? new Date(row.endsAt) : null,
    })),
    ["G", "H", "I", "J"],
  );
  flashSaleSheet.getColumn("B").numFmt = "dd/mm/yyyy hh:mm";
  flashSaleSheet.getColumn("C").numFmt = "dd/mm/yyyy hh:mm";
  flashSaleSheet.getColumn("K").numFmt = "0.00%";

  addReportSheet(
    workbook,
    "Theo danh mục",
    [
      { header: "Danh mục", key: "categoryName", width: 34 },
      { header: "Số lượng bán", key: "quantitySold", width: 16 },
      { header: "Doanh thu", key: "revenue", width: 20 },
    ],
    categories.rows,
    ["C"],
  );

  addReportSheet(
    workbook,
    "Theo bộ sưu tập",
    [
      { header: "Bộ sưu tập", key: "collectionName", width: 34 },
      { header: "Số lượng bán", key: "quantitySold", width: 16 },
      { header: "Doanh thu", key: "revenue", width: 20 },
    ],
    collections.rows,
    ["C"],
  );

  const buffer = await workbook.xlsx.writeBuffer();
  const suffix = allTime === "true" ? "toan-bo" : `${from?.slice(0, 10) || "bat-dau"}_${to?.slice(0, 10) || "hien-tai"}`;
  res.setHeader("Content-Type", XLSX_CONTENT_TYPE);
  res.setHeader("Content-Disposition", `attachment; filename="sales-report-${granularity}-${suffix}.xlsx"`);
  res.status(200).send(Buffer.from(buffer));
});
