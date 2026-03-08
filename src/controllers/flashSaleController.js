import {
  asyncHandler,
  sendError,
  sendSuccess,
  getPaginationParams,
} from "../utils/helpers.js";
import flashSaleService from "../services/flashSaleService.js";

export const getAllFlashSales = asyncHandler(async (req, res) => {
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);
  const sales = await flashSaleService.getAllFlashSales(
    {
      currentOnly: req.query.currentOnly === "true",
      isActive:
        req.query.isActive !== undefined ? req.query.isActive === "true" : undefined,
    },
    { page, limit },
  );

  sendSuccess(res, 200, sales, "Flash sales retrieved");
});

export const getFlashSaleById = asyncHandler(async (req, res) => {
  const sale = await flashSaleService.getFlashSaleById(req.params.id);

  if (!sale) {
    return sendError(res, 404, "Flash sale not found");
  }

  sendSuccess(res, 200, sale, "Flash sale retrieved");
});

export const createFlashSale = asyncHandler(async (req, res) => {
  const sale = await flashSaleService.createFlashSale(req.body);
  sendSuccess(res, 201, sale, "Flash sale created");
});
