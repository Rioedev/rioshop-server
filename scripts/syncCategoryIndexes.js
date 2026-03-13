import dotenv from "dotenv";
import mongoose from "mongoose";
import Category from "../src/models/Category.js";

dotenv.config();

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required in server/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  try {
    const collection = mongoose.connection.collection("categories");
    const indexes = await collection.indexes();
    const slugUniqueIndex = indexes.find(
      (index) => index.key?.slug === 1 && index.unique,
    );

    if (slugUniqueIndex && slugUniqueIndex.name !== "slug_1") {
      await collection.dropIndex(slugUniqueIndex.name);
      console.log(`Dropped old unique slug index: ${slugUniqueIndex.name}`);
    }

    if (slugUniqueIndex?.name === "slug_1") {
      await collection.dropIndex("slug_1");
      console.log("Dropped old unique slug index: slug_1");
    }

    await Category.syncIndexes();
    console.log("Category indexes synced");

    const updatedIndexes = await collection.indexes();
    const partialSlugIndex = updatedIndexes.find(
      (index) =>
        index.key?.slug === 1 &&
        index.unique &&
        index.partialFilterExpression?.deletedAt === null,
    );

    console.log(
      partialSlugIndex
        ? "Partial unique slug index is active"
        : "Partial unique slug index not found",
    );
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

run().catch((error) => {
  console.error("Sync category indexes failed:", error);
  process.exit(1);
});

