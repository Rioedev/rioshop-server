import slugify from "slugify";
import Policy from "../models/Policy.js";
import { AppError } from "../utils/helpers.js";

const ensureSlug = (rawTitle, rawSlug) => {
  const fromSlug = (rawSlug || "").toString().trim();
  if (fromSlug) return slugify(fromSlug, { lower: true, strict: true });
  return slugify((rawTitle || "").toString().trim(), {
    lower: true,
    strict: true,
  });
};

export class PolicyService {
  async list(filters = {}, options = {}) {
    const { page = 1, limit = 50, sort = { position: 1, createdAt: -1 } } = options;
    const query = { deletedAt: null, ...filters };
    return Policy.paginate(query, { page, limit, sort });
  }

  async listActiveByKind(kind) {
    return Policy.find({ kind, isActive: true, deletedAt: null })
      .sort({ position: 1, createdAt: -1 })
      .lean();
  }

  async getById(id) {
    return Policy.findOne({ _id: id, deletedAt: null });
  }

  async getActivePageBySlug(slug) {
    return Policy.findOne({
      kind: "page",
      slug,
      isActive: true,
      deletedAt: null,
    }).lean();
  }

  async create(payload) {
    const kind = payload?.kind;
    if (kind !== "strip" && kind !== "page") {
      throw new AppError("kind must be 'strip' or 'page'", 400);
    }
    const title = (payload?.title || "").toString().trim();
    if (!title) throw new AppError("title is required", 400);

    const data = {
      kind,
      title,
      iconKey: (payload?.iconKey || "").toString().trim(),
      summary: (payload?.summary || "").toString().trim(),
      content: payload?.content || "",
      position: Number(payload?.position) || 0,
      isActive: payload?.isActive !== false,
      slug: "",
    };

    if (kind === "page") {
      data.slug = ensureSlug(title, payload?.slug);
      if (!data.slug) throw new AppError("slug is required for page policies", 400);
      if (!data.content?.trim()) {
        throw new AppError("content is required for page policies", 400);
      }
      const collision = await Policy.findOne({
        kind: "page",
        slug: data.slug,
        deletedAt: null,
      });
      if (collision) throw new AppError("slug already in use", 409);
    } else {
      if (!data.iconKey) {
        throw new AppError("iconKey is required for strip policies", 400);
      }
    }

    return Policy.create(data);
  }

  async update(id, payload) {
    const existing = await this.getById(id);
    if (!existing) throw new AppError("Policy not found", 404);

    const next = {};
    if (payload?.title !== undefined) {
      const title = payload.title.toString().trim();
      if (!title) throw new AppError("title cannot be empty", 400);
      next.title = title;
    }
    if (payload?.iconKey !== undefined) {
      next.iconKey = payload.iconKey?.toString().trim() || "";
    }
    if (payload?.summary !== undefined) {
      next.summary = payload.summary?.toString().trim() || "";
    }
    if (payload?.content !== undefined) next.content = payload.content || "";
    if (payload?.position !== undefined) next.position = Number(payload.position) || 0;
    if (payload?.isActive !== undefined) next.isActive = Boolean(payload.isActive);

    if (existing.kind === "page" && payload?.slug !== undefined) {
      const slug = ensureSlug(next.title ?? existing.title, payload.slug);
      if (!slug) throw new AppError("slug cannot be empty", 400);
      const collision = await Policy.findOne({
        kind: "page",
        slug,
        deletedAt: null,
        _id: { $ne: existing._id },
      });
      if (collision) throw new AppError("slug already in use", 409);
      next.slug = slug;
    }

    if (existing.kind === "strip" && (next.iconKey === "" || (next.iconKey === undefined && !existing.iconKey))) {
      if (payload?.iconKey === "") {
        throw new AppError("iconKey is required for strip policies", 400);
      }
    }

    next.updatedAt = new Date();
    return Policy.findByIdAndUpdate(id, next, { new: true });
  }

  async remove(id) {
    const policy = await this.getById(id);
    if (!policy) throw new AppError("Policy not found", 404);
    policy.deletedAt = new Date();
    policy.isActive = false;
    await policy.save();
    return policy;
  }
}

export default new PolicyService();
