import { asyncHandler, sendSuccess, sendError } from "../utils/helpers.js";
import policyService from "../services/policyService.js";

export const listPolicies = asyncHandler(async (req, res) => {
  const { kind, isActive, page = 1, limit = 50 } = req.query;
  const filters = {};
  if (kind === "strip" || kind === "page") filters.kind = kind;
  if (isActive === "true") filters.isActive = true;
  if (isActive === "false") filters.isActive = false;

  const result = await policyService.list(filters, {
    page: Number(page) || 1,
    limit: Number(limit) || 50,
  });
  sendSuccess(res, 200, result, "Policies retrieved");
});

export const listActiveByKind = asyncHandler(async (req, res) => {
  const { kind } = req.params;
  if (kind !== "strip" && kind !== "page") {
    return sendError(res, 400, "kind must be 'strip' or 'page'");
  }
  const docs = await policyService.listActiveByKind(kind);
  sendSuccess(res, 200, docs, "Active policies retrieved");
});

export const getActivePageBySlug = asyncHandler(async (req, res) => {
  const policy = await policyService.getActivePageBySlug(req.params.slug);
  if (!policy) return sendError(res, 404, "Policy not found");
  sendSuccess(res, 200, policy, "Policy retrieved");
});

export const createPolicy = asyncHandler(async (req, res) => {
  const policy = await policyService.create(req.body);
  sendSuccess(res, 201, policy, "Policy created");
});

export const updatePolicy = asyncHandler(async (req, res) => {
  const policy = await policyService.update(req.params.id, req.body);
  sendSuccess(res, 200, policy, "Policy updated");
});

export const deletePolicy = asyncHandler(async (req, res) => {
  const policy = await policyService.remove(req.params.id);
  sendSuccess(res, 200, policy, "Policy deleted");
});
