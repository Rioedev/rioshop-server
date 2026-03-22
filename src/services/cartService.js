import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import couponService from "./couponService.js";
import { AppError } from "../utils/helpers.js";

const CART_ITEM_DELIMITER = "::";
const FALLBACK_CART_IMAGE =
  "https://dummyimage.com/400x400/e2e8f0/0f172a&text=RIO";

export class CartService {
  async getCartByUser(userId) {
    try {
      const cart = await this.getOrCreateCart(userId);
      await this.normalizeLegacyCartItems(cart);
      return cart;
    } catch (error) {
      throw error;
    }
  }

  async addItem(userId, itemData) {
    try {
      const cart = await this.getOrCreateCart(userId);
      await this.normalizeLegacyCartItems(cart);
      const requestedItem = this.normalizeRequestedItem(itemData);
      const itemSnapshot = await this.resolveCatalogSnapshot(
        requestedItem.productId,
        requestedItem.variantSku,
      );
      const itemIndex = this.findItemIndex(cart.items || [], itemSnapshot.itemId);

      if (itemIndex >= 0) {
        const nextQuantity = Number(cart.items[itemIndex].quantity || 0) + requestedItem.quantity;
        if (nextQuantity > itemSnapshot.stock) {
          throw new AppError(
            `Only ${itemSnapshot.stock} item(s) left for ${itemSnapshot.variantLabel}`,
            409,
          );
        }
        this.assignCartItemSnapshot(cart.items[itemIndex], itemSnapshot, nextQuantity);
      } else {
        if (requestedItem.quantity > itemSnapshot.stock) {
          throw new AppError(
            `Only ${itemSnapshot.stock} item(s) left for ${itemSnapshot.variantLabel}`,
            409,
          );
        }
        cart.items.push({
          itemId: itemSnapshot.itemId,
          productId: itemSnapshot.productId,
          productSlug: itemSnapshot.productSlug,
          variantSku: itemSnapshot.variantSku,
          productName: itemSnapshot.productName,
          variantLabel: itemSnapshot.variantLabel,
          image: itemSnapshot.image,
          unitPrice: itemSnapshot.unitPrice,
          availableStock: itemSnapshot.stock,
          quantity: requestedItem.quantity,
          addedAt: new Date(),
        });
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
      await this.normalizeLegacyCartItems(cart);
      const normalizedItemId = this.normalizeCartItemId(itemId);
      const itemIndex = this.findItemIndex(cart.items || [], normalizedItemId);

      if (itemIndex < 0) {
        throw new AppError("Cart item not found", 404);
      }

      const quantity = Number(payload.quantity);
      if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 0) {
        throw new AppError("Item quantity is invalid", 400);
      }

      if (quantity === 0) {
        cart.items.splice(itemIndex, 1);
      } else {
        const currentItem = cart.items[itemIndex];
        const itemSnapshot = await this.resolveCatalogSnapshot(
          currentItem.productId,
          currentItem.variantSku,
        );

        if (quantity > itemSnapshot.stock) {
          throw new AppError(
            `Only ${itemSnapshot.stock} item(s) left for ${itemSnapshot.variantLabel}`,
            409,
          );
        }

        this.assignCartItemSnapshot(cart.items[itemIndex], itemSnapshot, quantity);
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
      await this.normalizeLegacyCartItems(cart);
      const normalizedItemId = this.normalizeCartItemId(itemId);
      const itemIndex = this.findItemIndex(cart.items || [], normalizedItemId);

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

  normalizeRequestedItem(itemData) {
    const productId = itemData.productId?.toString().trim();
    const variantSku = itemData.variantSku?.toString().trim();
    const quantity = Number(itemData.quantity || 1);

    if (!productId || !variantSku) {
      throw new AppError("Invalid cart item payload", 400);
    }

    if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
      throw new AppError("Item quantity is invalid", 400);
    }

    return {
      productId,
      variantSku,
      quantity,
    };
  }

  normalizeCartItemId(itemId) {
    const target = itemId?.toString().trim();
    if (!target) {
      throw new AppError("Cart item id is required", 400);
    }
    return target;
  }

  buildCartItemId(productId, variantSku) {
    return `${productId?.toString().trim()}${CART_ITEM_DELIMITER}${variantSku?.toString().trim()}`;
  }

  async resolveCatalogSnapshot(productId, variantSku) {
    const product = await Product.findOne({
      _id: productId,
      deletedAt: null,
    }).select("slug name status pricing variants media");

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    if (!["active", "out_of_stock"].includes(product.status)) {
      throw new AppError("Product is unavailable", 409);
    }

    const normalizedVariantSku = variantSku?.toString().trim();
    const variant = (product.variants || []).find(
      (entry) =>
        (entry.sku || "").trim() === normalizedVariantSku && entry.isActive !== false,
    );

    if (!variant) {
      throw new AppError("Variant not found or inactive", 400);
    }

    const stock = Math.max(0, Number(variant.stock || 0));
    if (stock <= 0) {
      throw new AppError(`Variant ${normalizedVariantSku} is out of stock`, 409);
    }

    const unitPrice = Math.max(
      0,
      Number(product.pricing?.salePrice || 0) + Number(variant.additionalPrice || 0),
    );
    const variantLabel = this.buildVariantLabel(variant);

    const image =
      (variant.images || []).find((url) => Boolean(url)) ||
      (product.media || []).find((media) => media.type === "image" && media.url)?.url ||
      (product.media || []).find((media) => Boolean(media.url))?.url ||
      FALLBACK_CART_IMAGE;

    return {
      itemId: this.buildCartItemId(product._id, normalizedVariantSku),
      productId: product._id,
      productSlug: product.slug || "",
      productName: product.name || "",
      variantSku: normalizedVariantSku,
      variantLabel,
      image,
      unitPrice,
      stock,
    };
  }

  buildVariantLabel(variant = {}) {
    const colorName = variant.color?.name?.toString().trim();
    const sizeName = variant.sizeLabel?.toString().trim() || variant.size?.toString().trim();
    if (colorName && sizeName) {
      return `${colorName} / ${sizeName}`;
    }
    return colorName || sizeName || variant.sku || "Default";
  }

  assignCartItemSnapshot(cartItem, snapshot, quantity) {
    cartItem.itemId = snapshot.itemId;
    cartItem.productId = snapshot.productId;
    cartItem.productSlug = snapshot.productSlug;
    cartItem.variantSku = snapshot.variantSku;
    cartItem.productName = snapshot.productName;
    cartItem.variantLabel = snapshot.variantLabel;
    cartItem.image = snapshot.image;
    cartItem.unitPrice = snapshot.unitPrice;
    cartItem.availableStock = snapshot.stock;
    cartItem.quantity = quantity;
  }

  async normalizeLegacyCartItems(cart) {
    let changed = false;

    (cart.items || []).forEach((item) => {
      const normalizedId =
        item.itemId || this.buildCartItemId(item.productId, item.variantSku);
      if (normalizedId && item.itemId !== normalizedId) {
        item.itemId = normalizedId;
        changed = true;
      }

      if (Number(item.quantity || 0) <= 0) {
        item.quantity = 1;
        changed = true;
      }

      const normalizedStock = Math.max(
        1,
        Number(item.availableStock || item.quantity || 1),
      );
      if (Number(item.availableStock || 0) !== normalizedStock) {
        item.availableStock = normalizedStock;
        changed = true;
      }
    });

    if (changed) {
      cart.markModified("items");
    }
  }

  findItemIndex(items = [], itemId) {
    const target = this.normalizeCartItemId(itemId);

    return items.findIndex((item) => {
      const existingId =
        item.itemId || this.buildCartItemId(item.productId, item.variantSku);
      return existingId === target;
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
