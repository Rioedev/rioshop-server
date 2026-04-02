import slugify from "slugify";
import {
  asyncHandler,
  sendSuccess,
  sendError,
  getPaginationParams,
} from "../utils/helpers.js";
import collectionService from "../services/collectionService.js";
import Collection from "../models/Collection.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

export const getAllCollections = asyncHandler(async (req, res) => {
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);
  const { isActive } = req.query;

  const filters = {};
  if (isActive !== undefined) filters.isActive = isActive === "true";

  const collections = await collectionService.getAllCollections(filters, {
    page,
    limit,
  });

  sendSuccess(res, 200, collections, "Collections retrieved successfully");
});

export const getCollectionBySlug = asyncHandler(async (req, res) => {
  const collection = await collectionService.getCollectionBySlug(req.params.slug);

  if (!collection) {
    return sendError(res, 404, "Collection not found");
  }

  sendSuccess(res, 200, collection, "Collection retrieved successfully");
});

export const getCollectionById = asyncHandler(async (req, res) => {
  const collection = await collectionService.getCollectionById(req.params.id);

  if (!collection) {
    return sendError(res, 404, "Collection not found");
  }

  sendSuccess(res, 200, collection, "Collection retrieved successfully");
});

export const searchCollections = asyncHandler(async (req, res) => {
  const { q, page, limit, isActive } = req.query;
  const { page: pageNum, limit: limitNum } = getPaginationParams(page, limit);
  const filters = {};
  if (isActive !== undefined) filters.isActive = isActive === "true";

  const results = await collectionService.searchCollections(
    q,
    filters,
    {
      page: pageNum,
      limit: limitNum,
    },
  );

  sendSuccess(res, 200, results, "Collections searched successfully");
});

export const createCollection = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    image,
    bannerImage,
    position,
    isActive,
    startsAt,
    endsAt,
    seoMeta,
  } = req.body;

  const nextSlug = slugify(name, { lower: true, strict: true });
  const existing = await Collection.findOne({
    slug: nextSlug,
    deletedAt: null,
  });
  if (existing) {
    return sendError(res, 409, "Collection with this name already exists");
  }

  const collection = await collectionService.createCollection({
    name: name.trim(),
    slug: nextSlug,
    description: description?.trim() || "",
    image: image || "",
    bannerImage: bannerImage || "",
    position: position || 0,
    isActive: isActive ?? true,
    startsAt: startsAt || null,
    endsAt: endsAt || null,
    seoMeta,
  });

  sendSuccess(res, 201, collection, "Collection created successfully");
});

export const updateCollection = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    image,
    bannerImage,
    position,
    isActive,
    startsAt,
    endsAt,
    seoMeta,
  } = req.body;

  const collection = await collectionService.getCollectionById(id);
  if (!collection) {
    return sendError(res, 404, "Collection not found");
  }

  if (name && name.trim() !== collection.name) {
    const nextSlug = slugify(name, { lower: true, strict: true });
    const existing = await Collection.findOne({
      slug: nextSlug,
      _id: { $ne: id },
      deletedAt: null,
    });

    if (existing) {
      return sendError(res, 409, "Collection with this name already exists");
    }
  }

  const updateData = {};
  if (name !== undefined) {
    updateData.name = name.trim();
    updateData.slug = slugify(name, { lower: true, strict: true });
  }
  if (description !== undefined) updateData.description = description?.trim() || "";
  if (image !== undefined) updateData.image = image || "";
  if (bannerImage !== undefined) updateData.bannerImage = bannerImage || "";
  if (position !== undefined) updateData.position = position;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (startsAt !== undefined) updateData.startsAt = startsAt || null;
  if (endsAt !== undefined) updateData.endsAt = endsAt || null;
  if (seoMeta !== undefined) updateData.seoMeta = seoMeta;
  updateData.updatedAt = new Date();

  const updatedCollection = await collectionService.updateCollection(id, updateData);

  sendSuccess(res, 200, updatedCollection, "Collection updated successfully");
});

export const deleteCollection = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const collection = await collectionService.getCollectionById(id);
  if (!collection) {
    return sendError(res, 404, "Collection not found");
  }

  const deletedCollection = await collectionService.deleteCollection(id);
  sendSuccess(res, 200, deletedCollection, "Collection deleted successfully");
});

export const uploadCollectionImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 400, "File image is required");
  }

  if (!req.file.mimetype?.startsWith("image/")) {
    return sendError(res, 400, "Only image files are allowed");
  }

  const base64 = req.file.buffer.toString("base64");
  const dataUri = `data:${req.file.mimetype};base64,${base64}`;
  const uploadResult = await uploadToCloudinary(dataUri, "rioshop/collections");

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
