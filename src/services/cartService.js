import Cart from "../models/Cart.js";
import couponService from "./couponService.js";
import { AppError } from "../utils/helpers.js";

export class CartService {
  async getCartByUser(userId) {
    try {
      return await this.getOrCreateCart(userId);
    } catch (error) {
      throw error;
    }
  }

  async addItem(userId, itemData) {
    try {
      const cart = await this.getOrCreateCart(userId);
      const item = this.normalizeItem(itemData);
      const itemIndex = this.findItemIndex(cart.items || [], item.variantSku);

      if (itemIndex >= 0) {
        cart.items[itemIndex].quantity += item.quantity;
        cart.items[itemIndex].unitPrice = item.unitPrice;
      } else {
        cart.items.push(item);
      }

      await this.recalculateCart(cart, userId);
      await cart.save();

      return cart;
    } catch (error) {
      throw error;
    }
  }

  async updateCartItem(userId, itemId, payload = {}) {
    try {
      const cart = await this.getOrCreateCart(userId);
      const itemIndex = this.findItemIndex(cart.items || [], itemId);

      if (itemIndex < 0) {
        throw new AppError("Cart item not found", 404);
      }

      const item = cart.items[itemIndex];
      if (payload.quantity !== undefined) {
        item.quantity = Number(payload.quantity);
      }
      if (payload.unitPrice !== undefined) {
        item.unitPrice = Number(payload.unitPrice);
      }
      if (payload.variantLabel !== undefined) {
        item.variantLabel = payload.variantLabel;
      }
      if (payload.image !== undefined) {
        item.image = payload.image;
      }

      if (item.quantity <= 0) {
        cart.items.splice(itemIndex, 1);
      }

      await this.recalculateCart(cart, userId);
      await cart.save();

      return cart;
    } catch (error) {
      throw error;
    }
  }

  async removeCartItem(userId, itemId) {
    try {
      const cart = await this.getOrCreateCart(userId);
      const itemIndex = this.findItemIndex(cart.items || [], itemId);

      if (itemIndex < 0) {
        throw new AppError("Cart item not found", 404);
      }

      cart.items.splice(itemIndex, 1);
      await this.recalculateCart(cart, userId);
      await cart.save();

      return cart;
    } catch (error) {
      throw error;
    }
  }

  async applyCoupon(userId, couponCode) {
    try {
      if (!couponCode || typeof couponCode !== "string") {
        throw new AppError("Coupon code is required", 400);
      }

      const cart = await this.getOrCreateCart(userId);
      const subtotal = this.calculateSubtotal(cart.items || []);

      if (subtotal <= 0) {
        throw new AppError("Cannot apply coupon to empty cart", 400);
      }

      const validation = await couponService.validateCoupon(couponCode, {
        userId,
        orderValue: subtotal,
        productIds: (cart.items || []).map((item) => item.productId),
      });

      if (!validation.isValid) {
        throw new AppError(validation.reason, 400);
      }

      cart.couponCode = couponCode.toUpperCase();
      cart.couponDiscount = validation.discount;
      cart.subtotal = subtotal;
      cart.updatedAt = new Date();
      await cart.save();

      return {
        cart,
        discount: validation.discount,
      };
    } catch (error) {
      throw error;
    }
  }

  async clearCoupon(userId) {
    try {
      const cart = await this.getOrCreateCart(userId);
      cart.couponCode = undefined;
      cart.couponDiscount = 0;
      cart.updatedAt = new Date();
      await cart.save();

      return cart;
    } catch (error) {
      throw error;
    }
  }

  async clearCart(userId) {
    try {
      const cart = await this.getOrCreateCart(userId);
      cart.items = [];
      cart.couponCode = undefined;
      cart.couponDiscount = 0;
      cart.subtotal = 0;
      cart.updatedAt = new Date();
      await cart.save();

      return cart;
    } catch (error) {
      throw error;
    }
  }

  async getOrCreateCart(userId) {
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({
        userId,
        items: [],
        subtotal: 0,
        couponDiscount: 0,
        updatedAt: new Date(),
      });

      await cart.save();
    }

    return cart;
  }

  normalizeItem(itemData) {
    const quantity = Number(itemData.quantity || 1);
    const unitPrice = Number(itemData.unitPrice);

    if (!itemData.productId || !itemData.variantSku || !itemData.productName) {
      throw new AppError("Invalid cart item payload", 400);
    }
    if (!itemData.image) {
      throw new AppError("Item image is required", 400);
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new AppError("Item price is invalid", 400);
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new AppError("Item quantity is invalid", 400);
    }

    return {
      productId: itemData.productId,
      variantSku: itemData.variantSku,
      productName: itemData.productName,
      variantLabel: itemData.variantLabel || itemData.variantSku,
      image: itemData.image || "",
      unitPrice,
      quantity,
      addedAt: new Date(),
    };
  }

  findItemIndex(items = [], itemId) {
    const target = itemId?.toString();

    return items.findIndex((item) => {
      const productId = item.productId?.toString();
      const variantSku = item.variantSku?.toString();
      const embeddedId = item._id?.toString();

      return (
        embeddedId === target || productId === target || variantSku === target
      );
    });
  }

  calculateSubtotal(items = []) {
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);
      return sum + qty * unitPrice;
    }, 0);
  }

  async recalculateCart(cart, userId) {
    cart.subtotal = this.calculateSubtotal(cart.items || []);

    if (cart.couponCode) {
      const validation = await couponService.validateCoupon(cart.couponCode, {
        userId,
        orderValue: cart.subtotal,
        productIds: (cart.items || []).map((item) => item.productId),
      });

      if (validation.isValid) {
        cart.couponDiscount = validation.discount;
      } else {
        cart.couponCode = undefined;
        cart.couponDiscount = 0;
      }
    } else {
      cart.couponDiscount = 0;
    }

    cart.updatedAt = new Date();
  }
}

export default new CartService();
