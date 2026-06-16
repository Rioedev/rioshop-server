import Supplier from "../models/Supplier.js";
import { AppError } from "../utils/helpers.js";

class SupplierService {
  async list({ page = 1, limit = 50, search = "", isActive, type } = {}) {
    const query = { deletedAt: null };
    if (typeof isActive === "boolean") query.isActive = isActive;
    if (type === "internal" || type === "external") query.type = type;

    const trimmed = (search || "").trim();
    if (trimmed) {
      const regex = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ name: regex }, { phone: regex }, { email: regex }];
    }

    return Supplier.paginate(query, {
      page: Number(page) || 1,
      limit: Number(limit) || 50,
      sort: { name: 1 },
    });
  }

  async getById(id) {
    const supplier = await Supplier.findOne({ _id: id, deletedAt: null });
    if (!supplier) throw new AppError("Supplier not found", 404);
    return supplier;
  }

  async create(data) {
    const name = (data?.name || "").toString().trim();
    if (!name) throw new AppError("Supplier name is required", 400);

    const existing = await Supplier.findOne({ name, deletedAt: null });
    if (existing) throw new AppError("Nhà cung cấp với tên này đã tồn tại", 409);

    const supplier = new Supplier({
      name,
      type: data.type === "internal" ? "internal" : "external",
      phone: (data.phone || "").toString().trim(),
      email: (data.email || "").toString().trim(),
      address: (data.address || "").toString().trim(),
      note: (data.note || "").toString().trim(),
      isActive: data.isActive !== false,
    });
    await supplier.save();
    return supplier;
  }

  async update(id, data) {
    const supplier = await this.getById(id);

    if (data.name !== undefined) {
      const newName = data.name.toString().trim();
      if (!newName) throw new AppError("Supplier name is required", 400);
      if (newName !== supplier.name) {
        const dup = await Supplier.findOne({
          name: newName,
          deletedAt: null,
          _id: { $ne: id },
        });
        if (dup) throw new AppError("Nhà cung cấp với tên này đã tồn tại", 409);
      }
      supplier.name = newName;
    }

    ["phone", "email", "address", "note"].forEach((field) => {
      if (data[field] !== undefined) supplier[field] = (data[field] || "").toString().trim();
    });
    if (data.type === "internal" || data.type === "external") supplier.type = data.type;
    if (data.isActive !== undefined) supplier.isActive = Boolean(data.isActive);

    supplier.updatedAt = new Date();
    await supplier.save();
    return supplier;
  }

  async softDelete(id) {
    const supplier = await this.getById(id);
    supplier.deletedAt = new Date();
    supplier.isActive = false;
    await supplier.save();
    return supplier;
  }
}

export default new SupplierService();
