import {
  asyncHandler,
  sendSuccess,
  getPaginationParams,
} from "../utils/helpers.js";
import reviewService from "../services/reviewService.js";

export const getReviews = asyncHandler(async (req, res) => {
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);

  const result = await reviewService.getReviews({
    page,
    limit,
    productId: req.query.productId?.trim(),
    includePending: req.query.includePending !== "false",
    includeRejected: req.query.includeRejected !== "false",
    search: req.query.search?.trim() || "",
  });

  sendSuccess(res, 200, result, "Reviews retrieved");
});

export const getReviewsForProduct = asyncHandler(async (req, res) => {
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);
  const result = await reviewService.getReviewsByProduct(req.params.productId, {
    page,
    limit,
    includePending: false,
    includeRejected: false,
  });

  sendSuccess(res, 200, result, "Reviews retrieved");
});

export const createReview = asyncHandler(async (req, res) => {
  const review = await reviewService.createReview(
    req.user.userId,
    req.body,
    Boolean(req.user.adminId),
  );
  sendSuccess(res, 201, review, "Review created");
});

export const updateReview = asyncHandler(async (req, res) => {
  const review = await reviewService.updateReview(
    req.params.id,
    req.user.userId,
    req.body,
    Boolean(req.user.adminId),
  );

  sendSuccess(res, 200, review, "Review updated");
});

export const deleteReview = asyncHandler(async (req, res) => {
  const review = await reviewService.deleteReview(
    req.params.id,
    req.user.userId,
    Boolean(req.user.adminId),
  );

  sendSuccess(res, 200, review, "Review deleted");
});
