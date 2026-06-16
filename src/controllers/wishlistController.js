import { asyncHandler, sendSuccess } from "../utils/helpers.js";
import wishlistService from "../services/wishlistService.js";
import pricingService from "../services/pricingService.js";
import Product from "../models/Product.js";

const toWishlistResponseWithCurrentPricing = async (wishlist) => {
  const snapshot = wishlist?.toObject ? wishlist.toObject() : { ...wishlist };
  const productIds = [
    ...new Set((snapshot.items || []).map((item) => item.productId?.toString()).filter(Boolean)),
  ];

  if (productIds.length === 0) {
    return snapshot;
  }

  const products = await Product.find({
    _id: { $in: productIds },
    deletedAt: null,
  }).lean();
  const pricedProducts = await Promise.all(
    products.map((product) => pricingService.attachEffectivePricing(product)),
  );
  const productById = new Map(
    pricedProducts.map((product) => [product._id?.toString(), product]),
  );

  return {
    ...snapshot,
    items: (snapshot.items || []).map((item) => {
      const product = productById.get(item.productId?.toString());
      if (!product) {
        return item;
      }

      const sku = (item.variantSku || "").trim();
      const activeVariants = (product.variants || []).filter((variant) => variant.isActive !== false);
      const variant =
        activeVariants.find((entry) => (entry.sku || "").trim() === sku) ||
        activeVariants[0] ||
        null;
      const currentPrice = Number(variant?.effectivePricing?.unitPrice);

      return {
        ...item,
        productSlug: product.slug || item.productSlug,
        name: item.name || product.name,
        price: Number.isFinite(currentPrice) ? Math.max(0, currentPrice) : item.price,
      };
    }),
  };
};

export const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await wishlistService.getWishlistByUser(req.user.userId);
  const pricedWishlist = await toWishlistResponseWithCurrentPricing(wishlist);
  sendSuccess(res, 200, pricedWishlist, "Wishlist retrieved");
});

export const addToWishlist = asyncHandler(async (req, res) => {
  const wishlist = await wishlistService.addItem(req.user.userId, req.body);
  const pricedWishlist = await toWishlistResponseWithCurrentPricing(wishlist);
  sendSuccess(res, 201, pricedWishlist, "Item added to wishlist");
});

export const removeFromWishlist = asyncHandler(async (req, res) => {
  const wishlist = await wishlistService.removeItem(
    req.user.userId,
    req.params.productId,
    req.query.variantSku || null,
  );
  const pricedWishlist = await toWishlistResponseWithCurrentPricing(wishlist);
  sendSuccess(res, 200, pricedWishlist, "Item removed from wishlist");
});

export const clearWishlist = asyncHandler(async (req, res) => {
  const wishlist = await wishlistService.clearWishlist(req.user.userId);
  sendSuccess(res, 200, wishlist, "Wishlist cleared");
});
