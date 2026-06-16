import { asyncHandler, sendSuccess } from "../utils/helpers.js";
import supplierService from "../services/supplierService.js";

export const listSuppliers = asyncHandler(async (req, res) => {
  const { page, limit, search, isActive, type } = req.query;
  const parsedActive =
    isActive === "true" ? true : isActive === "false" ? false : undefined;
  const result = await supplierService.list({ page, limit, search, isActive: parsedActive, type });
  sendSuccess(res, 200, result, "OK");
});

export const getSupplier = asyncHandler(async (req, res) => {
  const supplier = await supplierService.getById(req.params.id);
  sendSuccess(res, 200, supplier, "OK");
});

export const createSupplier = asyncHandler(async (req, res) => {
  const supplier = await supplierService.create(req.body);
  sendSuccess(res, 201, supplier, "Created");
});

export const updateSupplier = asyncHandler(async (req, res) => {
  const supplier = await supplierService.update(req.params.id, req.body);
  sendSuccess(res, 200, supplier, "Updated");
});

export const deleteSupplier = asyncHandler(async (req, res) => {
  await supplierService.softDelete(req.params.id);
  sendSuccess(res, 200, {}, "Deleted");
});
