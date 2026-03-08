import { asyncHandler, sendError, sendSuccess } from "../utils/helpers.js";
import brandConfigService from "../services/brandConfigService.js";

export const getBrandConfig = asyncHandler(async (req, res) => {
  const config = await brandConfigService.getBrandConfig(req.params.brandKey);

  if (!config) {
    return sendError(res, 404, "Brand config not found");
  }

  sendSuccess(res, 200, config, "Brand config retrieved");
});

export const updateBrandConfig = asyncHandler(async (req, res) => {
  const config = await brandConfigService.updateBrandConfig(
    req.params.brandKey,
    req.body,
  );

  sendSuccess(res, 200, config, "Brand config updated");
});
