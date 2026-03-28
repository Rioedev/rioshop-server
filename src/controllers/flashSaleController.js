import {
  asyncHandler,
  sendError,
  sendSuccess,
  getPaginationParams,
} from "../utils/helpers.js";
import flashSaleService from "../services/flashSaleService.js";
import notificationService from "../services/notificationService.js";
import { getSocketServer } from "../sockets/socketGateway.js";

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
  if (sale?.isActive) {
    void notificationService.notifyFlashSalePublished(sale);
  }
  const io = getSocketServer();
  if (io?.emitFlashSaleUpdate && sale?._id) {
    io.emitFlashSaleUpdate(sale._id.toString(), {
      action: "created",
      source: "flash_sale_controller",
      flashSaleId: sale._id.toString(),
      isActive: Boolean(sale.isActive),
      updatedAt: sale.updatedAt || new Date(),
    });
  }
  sendSuccess(res, 201, sale, "Flash sale created");
});

export const updateFlashSale = asyncHandler(async (req, res) => {
  if (!ensureAdminAccess(req, res)) {
    return;
  }

  const existingSale = await flashSaleService.getFlashSaleById(req.params.id);
  if (!existingSale) {
    return sendError(res, 404, "Flash sale not found");
  }

  const sale = await flashSaleService.updateFlashSale(req.params.id, req.body);
  if (!sale) {
    return sendError(res, 404, "Flash sale not found");
  }

  if (!existingSale.isActive && sale.isActive) {
    void notificationService.notifyFlashSalePublished(sale);
  }
  const io = getSocketServer();
  if (io?.emitFlashSaleUpdate && sale?._id) {
    io.emitFlashSaleUpdate(sale._id.toString(), {
      action: "updated",
      source: "flash_sale_controller",
      flashSaleId: sale._id.toString(),
      isActive: Boolean(sale.isActive),
      updatedAt: sale.updatedAt || new Date(),
    });
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
  const io = getSocketServer();
  if (io?.emitFlashSaleUpdate && sale?._id) {
    io.emitFlashSaleUpdate(sale._id.toString(), {
      action: "deleted",
      source: "flash_sale_controller",
      flashSaleId: sale._id.toString(),
      isActive: Boolean(sale.isActive),
      updatedAt: new Date(),
    });
  }

  sendSuccess(res, 200, sale, "Flash sale deleted");
});
