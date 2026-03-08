import {
  asyncHandler,
  sendSuccess,
  getPaginationParams,
} from "../utils/helpers.js";
import reviewService from "../services/reviewService.js";

export const getReviewsForProduct = asyncHandler(async (req, res) => {
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);
  const result = await reviewService.getReviewsByProduct(req.params.productId, {
    page,
    limit,
    includePending: req.query.includePending === "true",
    includeRejected: req.query.includeRejected === "true",
  });

  sendSuccess(res, 200, result, "Reviews retrieved");
});

export const createReview = asyncHandler(async (req, res) => {
  const review = await reviewService.createReview(req.user.userId, req.body);
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
