import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

import Admin from "../src/models/Admin.js";
import AnalyticsEvent from "../src/models/AnalyticsEvent.js";
import BrandConfig from "../src/models/BrandConfig.js";
import Cart from "../src/models/Cart.js";
import Category from "../src/models/Category.js";
import Coupon from "../src/models/Coupon.js";
import FlashSale from "../src/models/FlashSale.js";
import Inventory from "../src/models/Inventory.js";
import Notification from "../src/models/Notification.js";
import Order from "../src/models/Order.js";
import Payment from "../src/models/Payment.js";
import Product from "../src/models/Product.js";
import Review from "../src/models/Review.js";
import Shipment from "../src/models/Shipment.js";
import User from "../src/models/User.js";
import Wishlist from "../src/models/Wishlist.js";

dotenv.config();

const now = new Date();
const dayMs = 24 * 60 * 60 * 1000;

const addDays = (base, days) => new Date(base.getTime() + days * dayMs);

const seedAllData = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required in .env");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  try {
    // Clear existing documents in all collections.
    await Promise.all([
      AnalyticsEvent.deleteMany({}),
      Notification.deleteMany({}),
      Review.deleteMany({}),
      Payment.deleteMany({}),
      Shipment.deleteMany({}),
      Order.deleteMany({}),
      Cart.deleteMany({}),
      Wishlist.deleteMany({}),
      FlashSale.deleteMany({}),
      Inventory.deleteMany({}),
      Coupon.deleteMany({}),
      Product.deleteMany({}),
      Category.deleteMany({}),
      BrandConfig.deleteMany({}),
      Admin.deleteMany({}),
      User.deleteMany({}),
    ]);

    const userSalt = await bcrypt.genSalt(10);
    const userPasswordHash = await bcrypt.hash("User@123", userSalt);
    const adminPasswordHash = await bcrypt.hash("Admin@123", userSalt);

    const users = await User.insertMany([
      {
        email: "nguyen.van.a@rioshop.vn",
        phone: "0912345678",
        passwordHash: userPasswordHash,
        fullName: "Nguyen Van A",
        gender: "male",
        emailVerified: true,
        phoneVerified: true,
        status: "active",
        referralCode: "A12345",
        loyalty: {
          tier: "silver",
          points: 220,
          lifetimePoints: 860,
        },
        preferences: {
          newsletter: true,
          smsAlert: true,
          favoriteCategories: ["ao-thun", "ao-khoac"],
        },
        addresses: [
          {
            id: "addr_a_1",
            label: "Nha rieng",
            fullName: "Nguyen Van A",
            phone: "0912345678",
            province: { code: "79", name: "TP Ho Chi Minh" },
            district: { code: "760", name: "Quan 1" },
            ward: { code: "26734", name: "Ben Nghe" },
            street: "12 Le Loi",
            isDefault: true,
          },
        ],
        defaultAddressId: "addr_a_1",
        totalOrders: 2,
        totalSpend: 1890000,
      },
      {
        email: "tran.thi.b@rioshop.vn",
        phone: "0987654321",
        passwordHash: userPasswordHash,
        fullName: "Tran Thi B",
        gender: "female",
        emailVerified: true,
        phoneVerified: true,
        status: "active",
        referralCode: "B67890",
        loyalty: {
          tier: "gold",
          points: 540,
          lifetimePoints: 1680,
        },
        preferences: {
          newsletter: true,
          smsAlert: false,
          favoriteCategories: ["dam-vay", "quan-jeans"],
        },
        addresses: [
          {
            id: "addr_b_1",
            label: "Van phong",
            fullName: "Tran Thi B",
            phone: "0987654321",
            province: { code: "01", name: "Ha Noi" },
            district: { code: "001", name: "Ba Dinh" },
            ward: { code: "00001", name: "Phuc Xa" },
            street: "88 Doi Can",
            isDefault: true,
          },
        ],
        defaultAddressId: "addr_b_1",
        totalOrders: 3,
        totalSpend: 3250000,
      },
      {
        email: "le.van.c@rioshop.vn",
        phone: "0901112233",
        passwordHash: userPasswordHash,
        fullName: "Le Van C",
        gender: "other",
        emailVerified: false,
        phoneVerified: true,
        status: "active",
        referralCode: "C44556",
        loyalty: {
          tier: "bronze",
          points: 80,
          lifetimePoints: 120,
        },
        totalOrders: 0,
        totalSpend: 0,
      },
    ]);

    const admins = await Admin.insertMany([
      {
        email: "superadmin@rioshop.vn",
        passwordHash: adminPasswordHash,
        fullName: "Rioshop Super Admin",
        role: "superadmin",
        permissions: ["all"],
        isActive: true,
      },
      {
        email: "manager@rioshop.vn",
        passwordHash: adminPasswordHash,
        fullName: "Store Manager",
        role: "manager",
        permissions: ["products", "orders", "inventory", "reports"],
        isActive: true,
      },
    ]);

    const categories = await Category.insertMany([
      {
        name: "Nam",
        slug: "nam",
        description: "Danh muc thoi trang nam",
        level: 0,
        path: "nam",
        isActive: true,
        position: 1,
      },
      {
        name: "Nu",
        slug: "nu",
        description: "Danh muc thoi trang nu",
        level: 0,
        path: "nu",
        isActive: true,
        position: 2,
      },
      {
        name: "Ao thun nam",
        slug: "ao-thun-nam",
        description: "Ao thun co ban cho nam",
        parentId: null,
        level: 1,
        path: "nam/ao-thun-nam",
        ancestors: [],
        isActive: true,
        position: 1,
      },
      {
        name: "Dam vay nu",
        slug: "dam-vay-nu",
        description: "Dam vay thoi trang nu",
        parentId: null,
        level: 1,
        path: "nu/dam-vay-nu",
        ancestors: [],
        isActive: true,
        position: 1,
      },
    ]);

    const menRoot = categories.find((c) => c.slug === "nam");
    const womenRoot = categories.find((c) => c.slug === "nu");
    const menTshirt = categories.find((c) => c.slug === "ao-thun-nam");
    const womenDress = categories.find((c) => c.slug === "dam-vay-nu");

    menTshirt.parentId = menRoot._id;
    menTshirt.ancestors = [{ _id: menRoot._id, name: menRoot.name, slug: menRoot.slug }];
    await menTshirt.save();

    womenDress.parentId = womenRoot._id;
    womenDress.ancestors = [{ _id: womenRoot._id, name: womenRoot.name, slug: womenRoot.slug }];
    await womenDress.save();

    const products = await Product.insertMany([
      {
        sku: "RIO-MTS-001",
        slug: "ao-thun-basic-nam-den",
        name: "Ao thun basic nam mau den",
        brand: "RIO Basics",
        description: "Ao thun cotton 100%, thoang khi, mac hang ngay.",
        shortDescription: "Ao thun basic nam",
        category: {
          _id: menTshirt._id,
          name: menTshirt.name,
          slug: menTshirt.slug,
          ancestors: menTshirt.ancestors,
        },
        tags: ["ao-thun", "cotton", "basic"],
        gender: "men",
        ageGroup: "adult",
        variants: [
          {
            variantId: "MTS001-BLK-M",
            sku: "RIO-MTS-001-BLK-M",
            color: { name: "Den", hex: "#000000" },
            size: "M",
            sizeLabel: "M",
            additionalPrice: 0,
            images: ["https://picsum.photos/seed/rio-mts-black/800/1000"],
            isActive: true,
            position: 1,
          },
          {
            variantId: "MTS001-BLK-L",
            sku: "RIO-MTS-001-BLK-L",
            color: { name: "Den", hex: "#000000" },
            size: "L",
            sizeLabel: "L",
            additionalPrice: 0,
            images: ["https://picsum.photos/seed/rio-mts-black-l/800/1000"],
            isActive: true,
            position: 2,
          },
        ],
        media: [
          {
            url: "https://picsum.photos/seed/rio-product-1/1000/1200",
            type: "image",
            altText: "Ao thun den",
            isPrimary: true,
            position: 1,
          },
        ],
        pricing: {
          basePrice: 299000,
          salePrice: 249000,
          currency: "VND",
        },
        status: "active",
        isFeatured: true,
        isNew: true,
        totalSold: 120,
        viewCount: 980,
        publishedAt: addDays(now, -20),
      },
      {
        sku: "RIO-WDR-001",
        slug: "dam-midi-nu-xanh",
        name: "Dam midi nu mau xanh",
        brand: "RIO Women",
        description: "Dam midi nhieu size, chat lieu mem mai.",
        shortDescription: "Dam midi nu",
        category: {
          _id: womenDress._id,
          name: womenDress.name,
          slug: womenDress.slug,
          ancestors: womenDress.ancestors,
        },
        tags: ["dam", "midi", "nu"],
        gender: "women",
        ageGroup: "adult",
        variants: [
          {
            variantId: "WDR001-BLU-S",
            sku: "RIO-WDR-001-BLU-S",
            color: { name: "Xanh", hex: "#1e88e5" },
            size: "S",
            sizeLabel: "S",
            additionalPrice: 0,
            images: ["https://picsum.photos/seed/rio-wdr-blue-s/800/1000"],
            isActive: true,
            position: 1,
          },
          {
            variantId: "WDR001-BLU-M",
            sku: "RIO-WDR-001-BLU-M",
            color: { name: "Xanh", hex: "#1e88e5" },
            size: "M",
            sizeLabel: "M",
            additionalPrice: 0,
            images: ["https://picsum.photos/seed/rio-wdr-blue-m/800/1000"],
            isActive: true,
            position: 2,
          },
        ],
        media: [
          {
            url: "https://picsum.photos/seed/rio-product-2/1000/1200",
            type: "image",
            altText: "Dam midi xanh",
            isPrimary: true,
            position: 1,
          },
        ],
        pricing: {
          basePrice: 599000,
          salePrice: 499000,
          currency: "VND",
        },
        status: "active",
        isFeatured: true,
        isBestseller: true,
        totalSold: 240,
        viewCount: 1760,
        publishedAt: addDays(now, -35),
      },
      {
        sku: "RIO-MJK-001",
        slug: "ao-khoac-gio-nam-xam",
        name: "Ao khoac gio nam mau xam",
        brand: "RIO Sport",
        description: "Ao khoac chong gio nhe, phu hop di chuyen hang ngay.",
        shortDescription: "Ao khoac gio nam",
        category: {
          _id: menRoot._id,
          name: menRoot.name,
          slug: menRoot.slug,
          ancestors: [],
        },
        tags: ["ao-khoac", "gio", "nam"],
        gender: "men",
        ageGroup: "adult",
        variants: [
          {
            variantId: "MJK001-GRY-L",
            sku: "RIO-MJK-001-GRY-L",
            color: { name: "Xam", hex: "#888888" },
            size: "L",
            sizeLabel: "L",
            additionalPrice: 0,
            images: ["https://picsum.photos/seed/rio-mjk-gray-l/800/1000"],
            isActive: true,
            position: 1,
          },
        ],
        media: [
          {
            url: "https://picsum.photos/seed/rio-product-3/1000/1200",
            type: "image",
            altText: "Ao khoac gio xam",
            isPrimary: true,
            position: 1,
          },
        ],
        pricing: {
          basePrice: 699000,
          salePrice: 629000,
          currency: "VND",
        },
        status: "active",
        isNew: true,
        totalSold: 58,
        viewCount: 420,
        publishedAt: addDays(now, -8),
      },
    ]);

    const inventories = await Inventory.insertMany([
      {
        productId: products[0]._id,
        variantSku: "RIO-MTS-001-BLK-M",
        warehouseId: "WH-HCM-01",
        warehouseName: "Kho Ho Chi Minh",
        onHand: 120,
        reserved: 8,
        available: 112,
        incoming: 20,
        reorderPoint: 30,
      },
      {
        productId: products[0]._id,
        variantSku: "RIO-MTS-001-BLK-L",
        warehouseId: "WH-HCM-01",
        warehouseName: "Kho Ho Chi Minh",
        onHand: 90,
        reserved: 4,
        available: 86,
        incoming: 10,
        reorderPoint: 25,
      },
      {
        productId: products[1]._id,
        variantSku: "RIO-WDR-001-BLU-S",
        warehouseId: "WH-HN-01",
        warehouseName: "Kho Ha Noi",
        onHand: 60,
        reserved: 6,
        available: 54,
        incoming: 0,
        reorderPoint: 20,
      },
      {
        productId: products[2]._id,
        variantSku: "RIO-MJK-001-GRY-L",
        warehouseId: "WH-HCM-01",
        warehouseName: "Kho Ho Chi Minh",
        onHand: 18,
        reserved: 3,
        available: 15,
        incoming: 30,
        reorderPoint: 20,
        lowStockAlert: true,
      },
    ]);

    const coupons = await Coupon.insertMany([
      {
        code: "WELCOME10",
        name: "Welcome 10%",
        description: "Giam 10% cho don dau tien",
        type: "percent",
        value: 10,
        maxDiscount: 100000,
        minOrderValue: 200000,
        usageLimit: 5000,
        perUserLimit: 1,
        usageCount: 0,
        isActive: true,
        startsAt: addDays(now, -10),
        expiresAt: addDays(now, 90),
        source: "campaign",
        createdBy: admins[0]._id,
      },
      {
        code: "FREESHIP50",
        name: "Free ship 50k",
        description: "Mien phi van chuyen toi da 50k",
        type: "free_ship",
        value: 50000,
        minOrderValue: 300000,
        usageLimit: 3000,
        perUserLimit: 2,
        usageCount: 2,
        isActive: true,
        startsAt: addDays(now, -3),
        expiresAt: addDays(now, 45),
        source: "manual",
        createdBy: admins[1]._id,
      },
    ]);

    const orders = await Order.insertMany([
      {
        orderNumber: "RS260309100001",
        userId: users[0]._id,
        customerSnapshot: {
          name: users[0].fullName,
          email: users[0].email,
          phone: users[0].phone,
        },
        items: [
          {
            productId: products[0]._id,
            variantSku: "RIO-MTS-001-BLK-M",
            productName: products[0].name,
            variantLabel: "Den / M",
            image: "https://picsum.photos/seed/order-item-1/500/600",
            unitPrice: 249000,
            quantity: 2,
            totalPrice: 498000,
          },
        ],
        shippingAddress: users[0].addresses[0],
        pricing: {
          subtotal: 498000,
          discount: 49800,
          shippingFee: 25000,
          total: 473200,
          currency: "VND",
        },
        couponCode: "WELCOME10",
        couponDiscount: 49800,
        paymentMethod: "momo",
        paymentStatus: "paid",
        shippingMethod: "standard",
        shippingCarrier: "GHN",
        shippingFee: 25000,
        status: "shipping",
        timeline: [
          { status: "pending", note: "Order created", by: "user", at: addDays(now, -2) },
          { status: "confirmed", note: "Order confirmed", by: "admin", at: addDays(now, -2) },
          { status: "shipping", note: "Handed to carrier", by: "warehouse", at: addDays(now, -1) },
        ],
        source: "web",
      },
      {
        orderNumber: "RS260309100002",
        userId: users[1]._id,
        customerSnapshot: {
          name: users[1].fullName,
          email: users[1].email,
          phone: users[1].phone,
        },
        items: [
          {
            productId: products[1]._id,
            variantSku: "RIO-WDR-001-BLU-M",
            productName: products[1].name,
            variantLabel: "Xanh / M",
            image: "https://picsum.photos/seed/order-item-2/500/600",
            unitPrice: 499000,
            quantity: 1,
            totalPrice: 499000,
          },
          {
            productId: products[2]._id,
            variantSku: "RIO-MJK-001-GRY-L",
            productName: products[2].name,
            variantLabel: "Xam / L",
            image: "https://picsum.photos/seed/order-item-3/500/600",
            unitPrice: 629000,
            quantity: 1,
            totalPrice: 629000,
          },
        ],
        shippingAddress: users[1].addresses[0],
        pricing: {
          subtotal: 1128000,
          discount: 50000,
          shippingFee: 30000,
          total: 1108000,
          currency: "VND",
        },
        couponCode: "FREESHIP50",
        couponDiscount: 50000,
        paymentMethod: "card",
        paymentStatus: "pending",
        shippingMethod: "express",
        shippingCarrier: "GHTK",
        shippingFee: 30000,
        status: "confirmed",
        timeline: [
          { status: "pending", note: "Order created", by: "user", at: addDays(now, -1) },
          { status: "confirmed", note: "Order confirmed", by: "admin", at: addDays(now, -1) },
        ],
        source: "mobile",
      },
    ]);

    const payments = await Payment.insertMany([
      {
        orderId: orders[0]._id,
        userId: users[0]._id,
        method: "momo",
        gateway: "momo",
        gatewayTxId: "MOMO_TX_260309_0001",
        amount: 473200,
        currency: "VND",
        status: "success",
        paidAt: addDays(now, -2),
        gatewayResponse: { resultCode: 0, message: "Successful" },
      },
      {
        orderId: orders[1]._id,
        userId: users[1]._id,
        method: "card",
        gateway: "card",
        gatewayTxId: "CARD_TX_260309_0002",
        amount: 1108000,
        currency: "VND",
        status: "pending",
      },
    ]);

    orders[0].paymentId = payments[0]._id;
    orders[1].paymentId = payments[1]._id;
    await orders[0].save();
    await orders[1].save();

    const shipments = await Shipment.insertMany([
      {
        orderId: orders[0]._id,
        carrier: "GHN",
        trackingCode: "GHN-TRACK-26030901",
        trackingUrl: "https://tracking.ghn.dev/GHN-TRACK-26030901",
        status: "in_transit",
        events: [
          {
            status: "ready",
            location: "Kho Ho Chi Minh",
            note: "Shipment created",
            at: addDays(now, -2),
          },
          {
            status: "picked_up",
            location: "Kho Ho Chi Minh",
            note: "Carrier picked up",
            at: addDays(now, -1),
          },
          {
            status: "in_transit",
            location: "Trung tam trung chuyen",
            note: "On delivery route",
            at: addDays(now, -1),
          },
        ],
        estimatedDelivery: addDays(now, 2),
        recipientName: users[0].fullName,
        recipientPhone: users[0].phone,
        shippingAddress: users[0].addresses[0],
        weight: 500,
        codAmount: 0,
      },
      {
        orderId: orders[1]._id,
        carrier: "GHTK",
        trackingCode: "GHTK-TRACK-26030902",
        trackingUrl: "https://tracking.ghtk.dev/GHTK-TRACK-26030902",
        status: "ready",
        events: [
          {
            status: "ready",
            location: "Kho Ha Noi",
            note: "Awaiting pickup",
            at: addDays(now, -1),
          },
        ],
        estimatedDelivery: addDays(now, 3),
        recipientName: users[1].fullName,
        recipientPhone: users[1].phone,
        shippingAddress: users[1].addresses[0],
        weight: 900,
        codAmount: 0,
      },
    ]);

    orders[0].shipmentId = shipments[0]._id;
    orders[1].shipmentId = shipments[1]._id;
    await orders[0].save();
    await orders[1].save();

    await Review.insertMany([
      {
        productId: products[0]._id,
        userId: users[0]._id,
        orderId: orders[0]._id,
        variantSku: "RIO-MTS-001-BLK-M",
        rating: 5,
        title: "Ao dep, mac thoai mai",
        body: "Chat vai mem, form dep, giao hang nhanh.",
        media: ["https://picsum.photos/seed/review-1/400/400"],
        fit: "true_to_size",
        quality: 5,
        status: "approved",
      },
      {
        productId: products[1]._id,
        userId: users[1]._id,
        orderId: orders[1]._id,
        variantSku: "RIO-WDR-001-BLU-M",
        rating: 4,
        title: "Dang dep",
        body: "Mau dep, chat lieu on, se ung ho tiep.",
        fit: "true_to_size",
        quality: 4,
        status: "pending",
      },
    ]);

    await Wishlist.insertMany([
      {
        userId: users[0]._id,
        items: [
          {
            productId: products[1]._id,
            variantSku: "RIO-WDR-001-BLU-S",
            name: products[1].name,
            image: "https://picsum.photos/seed/wishlist-1/500/600",
            price: 499000,
          },
        ],
      },
      {
        userId: users[1]._id,
        items: [
          {
            productId: products[0]._id,
            variantSku: "RIO-MTS-001-BLK-L",
            name: products[0].name,
            image: "https://picsum.photos/seed/wishlist-2/500/600",
            price: 249000,
          },
          {
            productId: products[2]._id,
            variantSku: "RIO-MJK-001-GRY-L",
            name: products[2].name,
            image: "https://picsum.photos/seed/wishlist-3/500/600",
            price: 629000,
          },
        ],
      },
    ]);

    await Cart.insertMany([
      {
        userId: users[0]._id,
        items: [
          {
            productId: products[2]._id,
            variantSku: "RIO-MJK-001-GRY-L",
            productName: products[2].name,
            variantLabel: "Xam / L",
            image: "https://picsum.photos/seed/cart-1/500/600",
            unitPrice: 629000,
            quantity: 1,
          },
        ],
        couponCode: "WELCOME10",
        couponDiscount: 62900,
        subtotal: 629000,
        note: "Giao gio hanh chinh",
        expiresAt: addDays(now, 7),
      },
      {
        sessionId: "guest_session_seed_260309",
        items: [
          {
            productId: products[0]._id,
            variantSku: "RIO-MTS-001-BLK-L",
            productName: products[0].name,
            variantLabel: "Den / L",
            image: "https://picsum.photos/seed/cart-guest/500/600",
            unitPrice: 249000,
            quantity: 2,
          },
        ],
        subtotal: 498000,
        expiresAt: addDays(now, 3),
      },
    ]);

    await Notification.insertMany([
      {
        userId: users[0]._id,
        type: "order_update",
        title: "Don hang dang van chuyen",
        body: `Don hang ${orders[0].orderNumber} dang tren duong giao den ban`,
        link: `/orders/${orders[0]._id}`,
        isRead: false,
        channel: ["in_app", "push"],
      },
      {
        userId: users[1]._id,
        type: "promo",
        title: "Voucher moi cho ban",
        body: "Nhap WELCOME10 de giam 10% don hang.",
        link: "/promotions",
        isRead: true,
        readAt: addDays(now, -1),
        channel: ["in_app", "email"],
      },
    ]);

    await AnalyticsEvent.insertMany([
      {
        event: "page_view",
        userId: users[0]._id,
        sessionId: "sess_seed_user_a",
        properties: { path: "/products/ao-thun-basic-nam-den" },
        device: {
          type: "mobile",
          os: "Android",
          browser: "Chrome",
        },
        ip: "127.0.0.1",
        utm: { source: "facebook", medium: "cpc", campaign: "summer_2026" },
      },
      {
        event: "add_to_cart",
        userId: users[0]._id,
        sessionId: "sess_seed_user_a",
        productId: products[2]._id,
        properties: { qty: 1, variantSku: "RIO-MJK-001-GRY-L" },
        device: {
          type: "desktop",
          os: "Windows",
          browser: "Edge",
        },
        ip: "127.0.0.1",
      },
      {
        event: "purchase",
        userId: users[1]._id,
        sessionId: "sess_seed_user_b",
        orderId: orders[1]._id,
        productId: products[1]._id,
        properties: { total: 1108000, paymentMethod: "card" },
        device: {
          type: "desktop",
          os: "macOS",
          browser: "Safari",
        },
        ip: "127.0.0.1",
      },
    ]);

    await FlashSale.insertMany([
      {
        name: "Flash Sale Cuoi Tuan",
        banner: "https://picsum.photos/seed/flash-sale-1/1200/400",
        startsAt: addDays(now, -1),
        endsAt: addDays(now, 1),
        isActive: true,
        createdBy: admins[1]._id,
        slots: [
          {
            productId: products[0]._id,
            variantSku: "RIO-MTS-001-BLK-M",
            salePrice: 219000,
            stockLimit: 100,
            sold: 35,
          },
          {
            productId: products[1]._id,
            variantSku: "RIO-WDR-001-BLU-S",
            salePrice: 459000,
            stockLimit: 80,
            sold: 21,
          },
        ],
      },
    ]);

    await BrandConfig.insertMany([
      {
        brandKey: "rioshop-default",
        displayName: "Rioshop",
        logo: {
          light: "https://picsum.photos/seed/logo-light/200/80",
          dark: "https://picsum.photos/seed/logo-dark/200/80",
        },
        theme: {
          primaryColor: "#0f172a",
          secondaryColor: "#f97316",
          fontFamily: "Poppins, sans-serif",
        },
        paymentGateways: [
          { provider: "momo", isActive: true, config: { mode: "test" } },
          { provider: "vnpay", isActive: true, config: { mode: "sandbox" } },
          { provider: "card", isActive: true, config: { mode: "mock" } },
        ],
        shippingRules: [
          {
            method: "standard",
            carriers: ["GHN", "GHTK"],
            feeSchedule: { baseFee: 25000, perKg: 5000 },
          },
          {
            method: "express",
            carriers: ["GHN"],
            feeSchedule: { baseFee: 35000, perKg: 8000 },
          },
        ],
        taxRate: 0.1,
        supportEmail: "support@rioshop.vn",
        supportPhone: "19001234",
        socialLinks: {
          facebook: "https://facebook.com/rioshop.vn",
          instagram: "https://instagram.com/rioshop.vn",
          tiktok: "https://tiktok.com/@rioshop.vn",
          youtube: "https://youtube.com/@rioshop.vn",
        },
        featureFlags: {
          loyalty: true,
          flashSale: true,
          review: true,
        },
        maintenanceMode: false,
      },
    ]);

    console.log("Seed completed.");
    console.log("Sample logins:");
    console.log("User: nguyen.van.a@rioshop.vn / User@123");
    console.log("User: tran.thi.b@rioshop.vn / User@123");
    console.log("Admin: superadmin@rioshop.vn / Admin@123");
    console.log("Admin: manager@rioshop.vn / Admin@123");
    console.log(`Seeded ${users.length} users, ${products.length} products, ${orders.length} orders.`);
    console.log(`Seeded ${payments.length} payments, ${shipments.length} shipments, ${inventories.length} inventory rows.`);
    console.log(`Seeded ${coupons.length} coupons and 1 brand config.`);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

seedAllData().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
