import FlashSale from "../models/FlashSale.js";

// Nguồn giá duy nhất của hệ thống.
// Mọi nơi tính tiền (cart, order, product detail API) phải đi qua đây
// để giá khách thấy = giá khách trả = giá ghi nhận trong đơn.
//
// Quy tắc:
//   - Giá thường (regular)  = product.pricing.salePrice + variant.additionalPrice
//   - Nếu có FlashSale slot đang active (now nằm trong [startsAt, endsAt],
//     isActive, sold < stockLimit) khớp (productId, variantSku)
//     → giá = slot.salePrice + variant.additionalPrice (priceSource = "flash_sale")
//   - listPrice = giá niêm yết để hiển thị gạch ngang
//       + Ưu tiên basePrice nếu admin có set và > effective unitPrice
//       + Nếu đang flash sale mà admin chưa set basePrice → dùng salePrice thường
//         làm listPrice (vì giá flash đang rẻ hơn → cần gạch ngang giá thường)
//
// Hàm này nhận sẵn product + variant (không tự query) để không bị N+1
// khi cart/order resolve nhiều dòng cùng lúc.
class PricingService {
  async findActiveFlashSlot(productId, variantSku) {
    if (!productId) return null;
    const now = new Date();
    const flashSale = await FlashSale.findOne({
      isActive: true,
      startsAt: { $lte: now },
      endsAt: { $gte: now },
      "slots.productId": productId,
    });
    if (!flashSale) return null;

    const normalizedSku = (variantSku || "").toString().trim();
    const slot = (flashSale.slots || []).find((entry) => {
      const sameProduct = entry.productId?.toString() === productId.toString();
      const sameSku = (entry.variantSku || "").trim() === normalizedSku;
      return sameProduct && sameSku;
    });

    if (!slot) return null;
    if (Number(slot.sold || 0) >= Number(slot.stockLimit || 0)) return null;

    return { flashSale, slot };
  }

  async resolveEffectivePrice(product, variant) {
    const regularBase = Math.max(0, Number(product?.pricing?.salePrice || 0));
    const variantAdd = Number(variant?.additionalPrice || 0);
    const regularUnit = Math.max(0, regularBase + variantAdd);
    const declaredListPrice = Math.max(0, Number(product?.pricing?.basePrice || 0));

    const flash = await this.findActiveFlashSlot(product._id, variant?.sku);

    if (flash) {
      const flashUnit = Math.max(
        0,
        Number(flash.slot.salePrice || 0) + variantAdd,
      );
      // listPrice = giá niêm yết admin set, nếu không có thì lấy giá thường
      // (vì khách cần thấy gạch ngang giá cao hơn flash)
      const listPrice = declaredListPrice > flashUnit
        ? declaredListPrice
        : Math.max(flashUnit, regularUnit);

      return {
        unitPrice: flashUnit,
        listPrice,
        priceSource: "flash_sale",
        flashSaleId: flash.flashSale._id,
        flashSale: flash.flashSale,
        flashSlot: flash.slot,
      };
    }

    // Không có flash sale → giá thường
    const listPrice = declaredListPrice > regularUnit ? declaredListPrice : regularUnit;
    return {
      unitPrice: regularUnit,
      listPrice,
      priceSource: "regular",
      flashSaleId: null,
      flashSale: null,
      flashSlot: null,
    };
  }

  // Trừ slot.sold cho 1 dòng đơn hàng dùng flash sale.
  // Được gọi sau khi order tạo thành công.
  // Ném lỗi nếu hết slot trong khoảng thời gian từ resolve → reserve
  // (race condition giữa 2 khách cùng mua flash slot cuối).
  async reserveFlashSlot(flashSaleId, productId, variantSku, quantity) {
    if (!flashSaleId || !productId) return null;
    const qty = Math.max(0, Number(quantity || 0));
    if (qty <= 0) return null;

    const normalizedSku = (variantSku || "").toString().trim();
    const flashSale = await FlashSale.findById(flashSaleId);
    if (!flashSale) return null;

    const slot = (flashSale.slots || []).find((entry) => {
      const sameProduct = entry.productId?.toString() === productId.toString();
      const sameSku = (entry.variantSku || "").trim() === normalizedSku;
      return sameProduct && sameSku;
    });
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

    const normalizedSku = (variantSku || "").toString().trim();
    const flashSale = await FlashSale.findById(flashSaleId);
    if (!flashSale) return null;

    const slot = (flashSale.slots || []).find((entry) => {
      const sameProduct = entry.productId?.toString() === productId.toString();
      const sameSku = (entry.variantSku || "").trim() === normalizedSku;
      return sameProduct && sameSku;
    });
    if (!slot) return null;

    slot.sold = Math.max(0, Number(slot.sold || 0) - qty);
    await flashSale.save();
    return { flashSale };
  }
}

export default new PricingService();
