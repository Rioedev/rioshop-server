import {
  asyncHandler,
  sendError,
  sendSuccess,
  getPaginationParams,
} from "../utils/helpers.js";
import orderService from "../services/orderService.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

export const getOrders = asyncHandler(async (req, res) => {
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);
  const { status, paymentStatus } = req.query;

  const filters = {};
  if (status) filters.status = status;
  if (paymentStatus) filters.paymentStatus = paymentStatus;

  if (!req.user.adminId) {
    filters.userId = req.user.userId;
  }

  const orders = await orderService.getOrders(filters, { page, limit });
  sendSuccess(res, 200, orders, "Orders retrieved");
});

export const getOrderById = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(
    req.params.id,
    req.user.adminId ? null : req.user.userId,
  );

  if (!order) {
    return sendError(res, 404, "Order not found");
  }

  sendSuccess(res, 200, order, "Order retrieved");
});

export const createOrder = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  if (!req.user.adminId) {
    payload.status = "pending";
  }

  const order = await orderService.createOrder(req.user.userId, payload);
  sendSuccess(res, 201, order, "Order created successfully");
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  if (!req.user.adminId) {
    return sendError(res, 403, "Only admin can update order status");
  }

  const order = await orderService.updateOrderStatus(req.params.id, req.body.status, {
    note: req.body.note,
    updatedBy: "admin",
    paymentStatus: req.body.paymentStatus,
  });

  sendSuccess(res, 200, order, "Order status updated");
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const order = await orderService.cancelOrder(
    req.params.id,
    req.user.adminId ? null : req.user.userId,
    {
      note: req.body.note,
      cancelledBy: req.user.adminId ? "admin" : "user",
    },
  );

  sendSuccess(res, 200, order, "Order cancelled");
});

export const submitReturnRequest = asyncHandler(async (req, res) => {
  if (req.user.adminId) {
    return sendError(res, 403, "Only customer can submit return request");
  }

  const order = await orderService.submitReturnRequest(req.params.id, req.user.userId, req.body);
  sendSuccess(res, 200, order, "Return request submitted");
});

export const updateReturnRequestStatus = asyncHandler(async (req, res) => {
  if (!req.user.adminId) {
    return sendError(res, 403, "Only admin can update return request status");
  }

  const order = await orderService.updateReturnRequestStatus(req.params.id, req.body.status, {
    note: req.body.note,
    updatedBy: "admin",
  });

  sendSuccess(res, 200, order, "Return request status updated");
});

export const uploadReturnRequestImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 400, "File image is required");
  }

  if (!req.file.mimetype?.startsWith("image/")) {
    return sendError(res, 400, "Only image files are allowed");
  }

  const base64 = req.file.buffer.toString("base64");
  const dataUri = `data:${req.file.mimetype};base64,${base64}`;
  const uploadResult = await uploadToCloudinary(dataUri, "rioshop/orders/return-requests");

  sendSuccess(
    res,
    200,
    {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    },
    "Image uploaded successfully",
  );
});
