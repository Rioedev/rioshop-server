import express from "express";
import { asyncHandler, sendSuccess } from "../utils/helpers.js";

const router = express.Router();

// Get brand config
router.get(
  "/:brandKey",
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Brand config retrieved");
  }),
);

// Update brand config
router.put(
  "/:brandKey",
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Brand config updated");
  }),
);

export default router;
