import FlashSale from "../models/FlashSale.js";

// Nguồn giá duy nhất của hệ thống.
// Mọi nơi tính tiền (cart, order, product detail API) phải đi qua đây
// để giá khách thấy = giá khách trả = giá ghi nhận trong đơn.
//
// Quy tắc:
//   - Giá thường (regular)  = product.pricing.regularPrice + variant.additionalPrice
//   - Nếu có FlashSale slot đang active (now nằm trong [startsAt, endsAt],
//     isActive, sold < stockLimit) khớp (productId, variantSku)
//     → giá = slot.salePrice + variant.additionalPrice (priceSource = "flash_sale")
//   - listPrice = giá tham chiếu để hiển thị gạch ngang
//       + Ưu tiên compareAtPrice nếu admin có set và > effective unitPrice
//       + Nếu đang flash sale mà admin chưa set compareAtPrice → dùng regularPrice thường
//         làm listPrice (vì giá flash đang rẻ hơn → cần gạch ngang giá thường)
//
// Hàm này nhận sẵn product + variant (không tự query) để không bị N+1
// khi cart/order resolve nhiều dòng cùng lúc.
const pickLegacyAwarePrice = (canonical, legacy) => {
  const canonicalNumber = Number(canonical);
  const legacyNumber = Number(legacy);

  if (Number.isFinite(canonicalNumber) && canonicalNumber > 0) {
    return Math.max(0, canonicalNumber);
  }
  if (Number.isFinite(legacyNumber) && legacyNumber > 0) {
    return Math.max(0, legacyNumber);
  }
  if (Number.isFinite(canonicalNumber)) {
    return Math.max(0, canonicalNumber);
  }
  if (Number.isFinite(legacyNumber)) {
    return Math.max(0, legacyNumber);
  }
  return 0;
};

class PricingService {
  findMatchingSlot(slots, productId, variantSku, availableOnly = true) {
    const normalizedSku = (variantSku || "").toString().trim();
    const candidates = (slots || []).filter((entry) => {
      const sameProduct = entry.productId?.toString() === productId?.toString();
      const hasStock = Number(entry.sold || 0) < Number(entry.stockLimit || 0);
      return sameProduct && (!availableOnly || hasStock);
    });

    return (
      candidates.find((entry) => {
        const slotSku = (entry.variantSku || "").trim();
        return Boolean(slotSku) && slotSku === normalizedSku;
      }) || candidates.find((entry) => !(entry.variantSku || "").trim()) || null
    );
  }

  async findActiveFlashSale(productId) {
    if (!productId) return null;
    const now = new Date();
    return FlashSale.findOne({
      isActive: true,
      startsAt: { $lte: now },
      endsAt: { $gte: now },
      "slots.productId": productId,
    }).sort({ startsAt: -1 });
  }

  async findActiveFlashSlot(productId, variantSku) {
    const flashSale = await this.findActiveFlashSale(productId);
    if (!flashSale) return null;

    const slot = this.findMatchingSlot(flashSale.slots, productId, variantSku);
    if (!slot) return null;

    return { flashSale, slot };
  }

  buildEffectivePrice(product, variant, flashSale = null) {
    const regularBase = pickLegacyAwarePrice(
      product?.pricing?.regularPrice,
      product?.pricing?.salePrice,
    );
    const variantAdd = Number(variant?.additionalPrice || 0);
    const regularUnit = Math.max(0, regularBase + variantAdd);
    const declaredListPrice = pickLegacyAwarePrice(
      product?.pricing?.compareAtPrice,
      product?.pricing?.basePrice,
    );
    const slot = flashSale
      ? this.findMatchingSlot(flashSale.slots, product?._id, variant?.sku)
      : null;

    if (slot) {
      const flashUnit = Math.max(0, Number(slot.salePrice || 0) + variantAdd);
      const listPrice = declaredListPrice > flashUnit
        ? declaredListPrice
        : Math.max(flashUnit, regularUnit);

      return {
        unitPrice: flashUnit,
        listPrice,
        priceSource: "flash_sale",
        flashSaleId: flashSale._id,
        flashSaleName: flashSale.name,
        flashSaleEndsAt: flashSale.endsAt,
      };
    }

    const listPrice = declaredListPrice > regularUnit ? declaredListPrice : regularUnit;
    return {
      unitPrice: regularUnit,
      listPrice,
      priceSource: "regular",
      flashSaleId: null,
      flashSaleName: null,
      flashSaleEndsAt: null,
    };
  }

  async resolveEffectivePrice(product, variant) {
    const flash = await this.findActiveFlashSlot(product._id, variant?.sku);
    const effective = this.buildEffectivePrice(product, variant, flash?.flashSale || null);
    return {
      ...effective,
      flashSale: flash?.flashSale || null,
      flashSlot: flash?.slot || null,
    };
  }

  async attachEffectivePricing(product) {
    const plainProduct = product?.toObject ? product.toObject() : { ...product };
    const flashSale = await this.findActiveFlashSale(plainProduct?._id);
    plainProduct.variants = (plainProduct.variants || []).map((variant) => ({
      ...(variant?.toObject ? variant.toObject() : variant),
      effectivePricing: this.buildEffectivePrice(plainProduct, variant, flashSale),
    }));
    return plainProduct;
  }

  // Trừ slot.sold cho 1 dòng đơn hàng dùng flash sale.
  // Được gọi sau khi order tạo thành công.
  // Ném lỗi nếu hết slot trong khoảng thời gian từ resolve → reserve
  // (race condition giữa 2 khách cùng mua flash slot cuối).
  async reserveFlashSlot(flashSaleId, productId, variantSku, quantity) {
    if (!flashSaleId || !productId) return null;
    const qty = Math.max(0, Number(quantity || 0));
    if (qty <= 0) return null;

    const flashSale = await FlashSale.findById(flashSaleId);
    if (!flashSale) return null;

    const slot =
      this.findMatchingSlot(flashSale.slots, productId, variantSku) ||
      this.findMatchingSlot(flashSale.slots, productId, variantSku, false);
    if (!slot) return null;

    const newSold = Number(slot.sold || 0) + qty;
    if (newSold > Number(slot.stockLimit || 0)) {
      // Hết slot — fallback giá thường, không trừ
      return { exhausted: true };
    }
    slot.sold = newSold;
    await flashSale.save();
    return { exhausted: false, flashSale };
  }

  // Hoàn slot.sold khi đơn hủy / hoàn trả
  async releaseFlashSlot(flashSaleId, productId, variantSku, quantity) {
    if (!flashSaleId || !productId) return null;
    const qty = Math.max(0, Number(quantity || 0));
    if (qty <= 0) return null;

    const flashSale = await FlashSale.findById(flashSaleId);
    if (!flashSale) return null;

    const slot = this.findMatchingSlot(flashSale.slots, productId, variantSku, false);
    if (!slot) return null;

    slot.sold = Math.max(0, Number(slot.sold || 0) - qty);
    await flashSale.save();
    return { flashSale };
  }
}

export default new PricingService();
