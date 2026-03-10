import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../src/models/User.js";

dotenv.config();

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required in server/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  try {
    const indexes = await User.collection.indexes();
    const referralIndex = indexes.find((idx) => idx.name === "referralCode_1");

    if (referralIndex) {
      await User.collection.dropIndex("referralCode_1");
      console.log("Dropped old index: referralCode_1");
    } else {
      console.log("Old referralCode_1 index not found, skipping drop.");
    }

    await User.syncIndexes();
    console.log("Synced indexes for User model.");
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

run().catch((error) => {
  console.error("Failed to fix user referral index:", error);
  process.exit(1);
});

