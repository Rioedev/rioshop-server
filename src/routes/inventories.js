import express from "express";
import { asyncHandler, sendSuccess } from "../utils/helpers.js";

const router = express.Router();

// Get inventory
router.get(
  "/:variantSku",
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Inventory retrieved");
  }),
);

// Update inventory
router.put(
  "/:variantSku",
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, {}, "Inventory updated");
  }),
);

// Get low stock items
router.get(
  "/",
  asyncHandler(async (req, res) => {
    sendSuccess(res, 200, { items: [] }, "Low stock items retrieved");
  }),
);

export default router;
