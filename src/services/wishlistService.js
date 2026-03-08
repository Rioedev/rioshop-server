import Wishlist from "../models/Wishlist.js";
import { AppError } from "../utils/helpers.js";

export class WishlistService {
  async getWishlistByUser(userId) {
    try {
      return await this.getOrCreateWishlist(userId);
    } catch (error) {
      throw error;
    }
  }

  async addItem(userId, itemData) {
    try {
      const wishlist = await this.getOrCreateWishlist(userId);
      const item = this.normalizeItem(itemData);

      const existingIndex = (wishlist.items || []).findIndex((entry) => {
        const sameProduct =
          entry.productId?.toString() === item.productId?.toString();
        const sameSku = (entry.variantSku || "") === (item.variantSku || "");
        return sameProduct && sameSku;
      });

      if (existingIndex >= 0) {
        wishlist.items[existingIndex] = {
          ...wishlist.items[existingIndex].toObject?.(),
          ...item,
          addedAt: wishlist.items[existingIndex].addedAt || new Date(),
        };
      } else {
        wishlist.items.push(item);
      }

      wishlist.updatedAt = new Date();
      await wishlist.save();
      return wishlist;
    } catch (error) {
      throw error;
    }
  }

  async removeItem(userId, productId, variantSku = null) {
    try {
      const wishlist = await this.getOrCreateWishlist(userId);
      const before = wishlist.items.length;

      wishlist.items = (wishlist.items || []).filter((item) => {
        const sameProduct = item.productId?.toString() === productId?.toString();
        const sameSku = variantSku
          ? (item.variantSku || "") === variantSku
          : true;

        return !(sameProduct && sameSku);
      });

      if (before === wishlist.items.length) {
        throw new AppError("Wishlist item not found", 404);
      }

      wishlist.updatedAt = new Date();
      await wishlist.save();
      return wishlist;
    } catch (error) {
      throw error;
    }
  }

  async clearWishlist(userId) {
    try {
      const wishlist = await this.getOrCreateWishlist(userId);
      wishlist.items = [];
      wishlist.updatedAt = new Date();
      await wishlist.save();
      return wishlist;
    } catch (error) {
      throw error;
    }
  }

  async getOrCreateWishlist(userId) {
    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = new Wishlist({
        userId,
        items: [],
        updatedAt: new Date(),
      });
      await wishlist.save();
    }

    return wishlist;
  }

  normalizeItem(itemData) {
    if (!itemData.productId || !itemData.name) {
      throw new AppError("Invalid wishlist item payload", 400);
    }
    if (!itemData.image) {
      throw new AppError("Wishlist item image is required", 400);
    }

    return {
      productId: itemData.productId,
      variantSku: itemData.variantSku || "",
      name: itemData.name,
      image: itemData.image,
      price: Number(itemData.price || 0),
      addedAt: itemData.addedAt || new Date(),
    };
  }
}

export default new WishlistService();
