import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Admin from "../src/models/Admin.js";

dotenv.config();

const password = "Admin@123456";

const accounts = [
  {
    email: "manager.demo@rioshop.com",
    fullName: "Demo Manager",
    role: "manager",
  },
  {
    email: "warehouse.demo@rioshop.com",
    fullName: "Demo Warehouse",
    role: "warehouse",
  },
  {
    email: "sales.demo@rioshop.com",
    fullName: "Demo Sales",
    role: "sales",
  },
];

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("Missing MONGO_URI");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const passwordHash = await bcrypt.hash(password, 10);
  const result = [];

  for (const account of accounts) {
    const email = account.email.toLowerCase();
    const existing = await Admin.findOne({ email });

    if (existing) {
      result.push({ email, role: existing.role, status: "exists" });
      continue;
    }

    await Admin.create({
      ...account,
      email,
      passwordHash,
      permissions: [],
      warehouseIds: [],
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    result.push({ email, role: account.role, status: "created" });
  }

  console.table(result);
  console.log(`Default password for newly created accounts: ${password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
