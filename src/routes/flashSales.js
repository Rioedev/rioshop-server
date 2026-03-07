import express from "express";
import {
  asyncHandler,
  sendSuccess,
  getPaginationParams,
} from "../utils/helpers.js";

const router = express.Router();

// Get all flash sales
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit } = getPaginationParams(
      req.query.page,
      req.query.limit,
    );
    sendSuccess(
      res,
      200,
      { sales: [], pagination: { page, limit } },
      "Flash sales retrieved",
    );
  }),
);

// Get flash sale details
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Flash sale retrieved");
  }),
);

// Create flash sale
router.post(
  "/",
  asyncHandler(async (req, res) => {
    sendSuccess(res, 201, {}, "Flash sale created");
  }),
);

export default router;
