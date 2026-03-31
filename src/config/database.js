import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (typeof mongoUri !== "string" || !mongoUri.trim()) {
      throw new Error(
        "Missing MongoDB connection string. Set MONGO_URI (preferred) or MONGODB_URI in environment variables.",
      );
    }

    const conn = await mongoose.connect(mongoUri,{
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: "majority",
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    throw error;
  }
};

mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  console.log("MongoDB reconnected");
});

mongoose.connection.on("error", (error) => {
  console.error("MongoDB connected error:", error);
});

export default connectDB;
