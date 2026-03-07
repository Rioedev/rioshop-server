import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import Admin from "../src/models/Admin.js";

dotenv.config();

const createSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGO_URI,
    );

    console.log("Connected to MongoDB");

    // Check if superadmin already exists
    const existingSuperAdmin = await Admin.findOne({ role: "superadmin" });

    if (existingSuperAdmin) {
      console.log("Superadmin already exists:");
      console.log(`Email: ${existingSuperAdmin.email}`);
      console.log(`Full Name: ${existingSuperAdmin.fullName}`);
      console.log(`Role: ${existingSuperAdmin.role}`);
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("SuperAdmin@123", salt);

    // Create superadmin
    const superAdmin = new Admin({
      email: "superadmin@rioshop.com",
      passwordHash,
      fullName: "Super Administrator",
      role: "superadmin",
      permissions: ["all"],
      isActive: true,
    });

    await superAdmin.save();

    console.log("Superadmin account created successfully!");
    console.log("Email: superadmin@rioshop.com");
    console.log("Password: SuperAdmin@123");
    console.log("Role: superadmin");
  } catch (error) {
    console.error("Error creating superadmin:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

// Run the script
createSuperAdmin();
