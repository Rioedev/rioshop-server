import {
  asyncHandler,
  sendError,
  sendSuccess,
  getPaginationParams,
} from "../utils/helpers.js";
import flashSaleService from "../services/flashSaleService.js";

const ensureAdminAccess = (req, res) => {
  if (!req.user?.adminId) {
    sendError(res, 403, "Only admin can manage flash sales");
    return false;
  }

  return true;
};

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
  if (!ensureAdminAccess(req, res)) {
    return;
  }

  const sale = await flashSaleService.createFlashSale({
    ...req.body,
    createdBy: req.user.adminId,
  });
  sendSuccess(res, 201, sale, "Flash sale created");
});

export const updateFlashSale = asyncHandler(async (req, res) => {
  if (!ensureAdminAccess(req, res)) {
    return;
  }

  const sale = await flashSaleService.updateFlashSale(req.params.id, req.body);
  if (!sale) {
    return sendError(res, 404, "Flash sale not found");
  }

  sendSuccess(res, 200, sale, "Flash sale updated");
});

export const deleteFlashSale = asyncHandler(async (req, res) => {
  if (!ensureAdminAccess(req, res)) {
    return;
  }

  const sale = await flashSaleService.deleteFlashSale(req.params.id);
  if (!sale) {
    return sendError(res, 404, "Flash sale not found");
  }

  sendSuccess(res, 200, sale, "Flash sale deleted");
});
