import express from "express";
import {
  asyncHandler,
  sendSuccess,
  getPaginationParams,
} from "../utils/helpers.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = express.Router();

// Get reviews for product
router.get(
  "/product/:productId",
  asyncHandler(async (req, res) => {
    const { page, limit } = getPaginationParams(
      req.query.page,
      req.query.limit,
    );
    sendSuccess(
      res,
      200,
      { reviews: [], pagination: { page, limit } },
      "Reviews retrieved",
    );
  }),
);

// Create review
router.post(
  "/",
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, 201, {}, "Review created");
  }),
);

// Update review
router.put(
  "/:id",
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Review updated");
  }),
);

// Delete review
router.delete(
  "/:id",
  authenticateToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Review deleted");
  }),
);

export default router;
