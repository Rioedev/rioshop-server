import dotenv from "dotenv";
import mongoose from "mongoose";
import { createClient } from "redis";
import Category from "../src/models/Category.js";

dotenv.config();

const now = new Date();

const buildCategory = ({
  name,
  slug,
  description,
  parentId = null,
  ancestors = [],
  level = 0,
  path,
  position,
  icon,
  image,
  isActive = true,
}) => ({
  name,
  slug,
  description,
  parentId,
  ancestors,
  level,
  path,
  position,
  icon,
  image,
  isActive,
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
});

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required in server/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const redisClient = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
  });

  try {
    await Category.deleteMany({});
    console.log("Deleted all existing categories");

    const [men, women, accessories] = await Category.insertMany([
      buildCategory({
        name: "Thoi trang nam",
        slug: "thoi-trang-nam",
        description: "Danh muc san pham thoi trang cho nam",
        level: 0,
        path: "thoi-trang-nam",
        position: 0,
        icon: "man-outline",
        image: "https://picsum.photos/seed/cat-men/600/600",
      }),
      buildCategory({
        name: "Thoi trang nu",
        slug: "thoi-trang-nu",
        description: "Danh muc san pham thoi trang cho nu",
        level: 0,
        path: "thoi-trang-nu",
        position: 1,
        icon: "woman-outline",
        image: "https://picsum.photos/seed/cat-women/600/600",
      }),
      buildCategory({
        name: "Phu kien",
        slug: "phu-kien",
        description: "Danh muc phu kien thoi trang",
        level: 0,
        path: "phu-kien",
        position: 2,
        icon: "pricetag-outline",
        image: "https://picsum.photos/seed/cat-accessories/600/600",
      }),
    ]);

    await Category.insertMany([
      buildCategory({
        name: "Ao thun nam",
        slug: "ao-thun-nam",
        description: "Ao thun nam mac hang ngay",
        parentId: men._id,
        ancestors: [{ _id: men._id, name: men.name, slug: men.slug }],
        level: 1,
        path: `${men.slug}/ao-thun-nam`,
        position: 0,
        icon: "shirt-outline",
        image: "https://picsum.photos/seed/cat-men-tee/600/600",
      }),
      buildCategory({
        name: "Quan jean nam",
        slug: "quan-jean-nam",
        description: "Quan jean nam form slim va regular",
        parentId: men._id,
        ancestors: [{ _id: men._id, name: men.name, slug: men.slug }],
        level: 1,
        path: `${men.slug}/quan-jean-nam`,
        position: 1,
        icon: "walk-outline",
        image: "https://picsum.photos/seed/cat-men-jeans/600/600",
      }),
      buildCategory({
        name: "Dam vay nu",
        slug: "dam-vay-nu",
        description: "Dam vay di lam va di choi",
        parentId: women._id,
        ancestors: [{ _id: women._id, name: women.name, slug: women.slug }],
        level: 1,
        path: `${women.slug}/dam-vay-nu`,
        position: 0,
        icon: "sparkles-outline",
        image: "https://picsum.photos/seed/cat-women-dress/600/600",
      }),
      buildCategory({
        name: "Ao khoac nu",
        slug: "ao-khoac-nu",
        description: "Ao khoac nu theo mua",
        parentId: women._id,
        ancestors: [{ _id: women._id, name: women.name, slug: women.slug }],
        level: 1,
        path: `${women.slug}/ao-khoac-nu`,
        position: 1,
        icon: "snow-outline",
        image: "https://picsum.photos/seed/cat-women-jacket/600/600",
      }),
      buildCategory({
        name: "Tui xach",
        slug: "tui-xach",
        description: "Tui xach va balo",
        parentId: accessories._id,
        ancestors: [{ _id: accessories._id, name: accessories.name, slug: accessories.slug }],
        level: 1,
        path: `${accessories.slug}/tui-xach`,
        position: 0,
        icon: "bag-outline",
        image: "https://picsum.photos/seed/cat-bags/600/600",
      }),
      buildCategory({
        name: "That lung",
        slug: "that-lung",
        description: "That lung da va vai",
        parentId: accessories._id,
        ancestors: [{ _id: accessories._id, name: accessories.name, slug: accessories.slug }],
        level: 1,
        path: `${accessories.slug}/that-lung`,
        position: 1,
        icon: "remove-outline",
        image: "https://picsum.photos/seed/cat-belts/600/600",
      }),
    ]);

    const total = await Category.countDocuments();
    console.log(`Inserted sample categories: ${total}`);

    await redisClient.connect();
    const cacheKeys = await redisClient.keys("category:*");
    if (cacheKeys.length > 0) {
      await redisClient.del(cacheKeys);
    }
    console.log(`Cleared category cache keys: ${cacheKeys.length}`);
  } finally {
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

run().catch((error) => {
  console.error("Reset categories failed:", error);
  process.exit(1);
});
