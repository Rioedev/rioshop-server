import slugify from "slugify";
import {
  asyncHandler,
  getPaginationParams,
  sendError,
  sendSuccess,
} from "../utils/helpers.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import Blog from "../models/Blog.js";
import blogService from "../services/blogService.js";

const normalizeBoolean = (value) => {
  if (value === undefined) return undefined;
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
};

/**
 * GET /api/blogs
 * Get blogs with pagination/filtering
 */
export const getAllBlogs = asyncHandler(async (req, res) => {
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);
  const { q, tag } = req.query;
  const featured = normalizeBoolean(req.query.featured);
  const publicationQuery = req.query.isPublished;
  const isPublished = normalizeBoolean(publicationQuery);
  const includeAllStatuses = publicationQuery === "all";

  const filters = {};

  if (includeAllStatuses) {
    // Do not apply publication filter.
  } else if (isPublished === undefined) {
    // Public list defaults to only published blogs
    filters.isPublished = true;
    filters.publishedAt = { $lte: new Date() };
  } else if (isPublished) {
    filters.isPublished = true;
    filters.publishedAt = { $lte: new Date() };
  } else {
    filters.isPublished = false;
  }

  if (featured !== undefined) {
    filters.isFeatured = featured;
  }

  if (tag) {
    filters.tags = { $in: [String(tag).trim()] };
  }

  if (q) {
    const keyword = String(q).trim();
    filters.$or = [
      { title: { $regex: keyword, $options: "i" } },
      { excerpt: { $regex: keyword, $options: "i" } },
      { content: { $regex: keyword, $options: "i" } },
    ];
  }

  const blogs = await blogService.getAllBlogs(filters, {
    page,
    limit,
    sort: { isFeatured: -1, publishedAt: -1, createdAt: -1 },
  });

  sendSuccess(res, 200, blogs, "Blogs retrieved successfully");
});

/**
 * GET /api/blogs/:slug
 * Get blog by slug
 */
export const getBlogBySlug = asyncHandler(async (req, res) => {
  const blog = await blogService.getBlogBySlug(req.params.slug, {
    publishedOnly: true,
  });

  if (!blog) {
    return sendError(res, 404, "Blog not found");
  }

  sendSuccess(res, 200, blog, "Blog retrieved successfully");
});

/**
 * POST /api/blogs
 * Create blog
 */
export const createBlog = asyncHandler(async (req, res) => {
  const {
    title,
    slug,
    excerpt,
    content,
    coverImage,
    tags,
    authorName,
    isPublished,
    isFeatured,
    publishedAt,
  } = req.body;

  const resolvedSlug = (slug?.trim() || slugify(title, { lower: true, strict: true })).trim();

  const existed = await Blog.findOne({
    slug: resolvedSlug,
    deletedAt: null,
  });

  if (existed) {
    return sendError(res, 409, "Blog slug already exists");
  }

  const blog = await blogService.createBlog({
    title: title.trim(),
    slug: resolvedSlug,
    excerpt: excerpt?.trim() || "",
    content: content?.trim() || "",
    coverImage: coverImage?.trim() || "",
    tags: Array.isArray(tags) ? tags.map((item) => String(item).trim()).filter(Boolean) : [],
    authorName: authorName?.trim() || "RioShop",
    isPublished: typeof isPublished === "boolean" ? isPublished : true,
    isFeatured: Boolean(isFeatured),
    publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
    updatedAt: new Date(),
  });

  sendSuccess(res, 201, blog, "Blog created successfully");
});

/**
 * PUT /api/blogs/:id
 * Update blog
 */
export const updateBlog = asyncHandler(async (req, res) => {
  const existing = await blogService.getBlogById(req.params.id);

  if (!existing) {
    return sendError(res, 404, "Blog not found");
  }

  const {
    title,
    slug,
    excerpt,
    content,
    coverImage,
    tags,
    authorName,
    isPublished,
    isFeatured,
    publishedAt,
  } = req.body;

  const updateData = {
    updatedAt: new Date(),
  };

  if (title !== undefined) {
    updateData.title = title.trim();
  }
  if (excerpt !== undefined) {
    updateData.excerpt = excerpt?.trim() || "";
  }
  if (content !== undefined) {
    updateData.content = content?.trim() || "";
  }
  if (coverImage !== undefined) {
    updateData.coverImage = coverImage?.trim() || "";
  }
  if (authorName !== undefined) {
    updateData.authorName = authorName?.trim() || "RioShop";
  }
  if (isPublished !== undefined) {
    updateData.isPublished = Boolean(isPublished);
  }
  if (isFeatured !== undefined) {
    updateData.isFeatured = Boolean(isFeatured);
  }
  if (publishedAt !== undefined) {
    updateData.publishedAt = publishedAt ? new Date(publishedAt) : null;
  }
  if (tags !== undefined) {
    updateData.tags = Array.isArray(tags)
      ? tags.map((item) => String(item).trim()).filter(Boolean)
      : [];
  }

  if (slug !== undefined || title !== undefined) {
    const resolvedSlug = (slug?.trim() || slugify(title ?? existing.title, { lower: true, strict: true })).trim();
    const duplicate = await Blog.findOne({
      slug: resolvedSlug,
      _id: { $ne: existing._id },
      deletedAt: null,
    });

    if (duplicate) {
      return sendError(res, 409, "Blog slug already exists");
    }

    updateData.slug = resolvedSlug;
  }

  const updated = await blogService.updateBlog(req.params.id, updateData);
  sendSuccess(res, 200, updated, "Blog updated successfully");
});

/**
 * DELETE /api/blogs/:id
 * Soft delete blog
 */
export const deleteBlog = asyncHandler(async (req, res) => {
  const deleted = await blogService.deleteBlog(req.params.id);

  if (!deleted) {
    return sendError(res, 404, "Blog not found");
  }

  sendSuccess(res, 200, deleted, "Blog deleted successfully");
});

/**
 * POST /api/blogs/upload-image
 * Upload image for blog editor
 */
export const uploadBlogImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 400, "File image is required");
  }

  if (!req.file.mimetype?.startsWith("image/")) {
    return sendError(res, 400, "Only image files are allowed");
  }

  const base64 = req.file.buffer.toString("base64");
  const dataUri = `data:${req.file.mimetype};base64,${base64}`;
  const uploadResult = await uploadToCloudinary(dataUri, "rioshop/blogs");

  sendSuccess(
    res,
    200,
    {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    },
    "Image uploaded successfully",
  );
});
