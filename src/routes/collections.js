import express from "express";
import multer from "multer";
import {
  getAllCollections,
  getCollectionBySlug,
  getCollectionById,
  searchCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  uploadCollectionImage,
} from "../controllers/collectionController.js";
import { authenticateToken } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validation.js";
import {
  createCollectionValidation,
  updateCollectionValidation,
  collectionPaginationValidation,
  searchCollectionValidation,
  getCollectionByIdValidation,
  deleteCollectionValidation,
} from "../validations/collections.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

router.get("/", validateRequest(collectionPaginationValidation), getAllCollections);
router.get("/search", validateRequest(searchCollectionValidation), searchCollections);
router.post("/upload-image", authenticateToken, upload.single("file"), uploadCollectionImage);
router.get("/id/:id", validateRequest(getCollectionByIdValidation), getCollectionById);
router.get("/:slug", getCollectionBySlug);

// Admin routes — yêu cầu auth
router.post("/", authenticateToken, validateRequest(createCollectionValidation), createCollection);
router.put("/:id", authenticateToken, validateRequest(getCollectionByIdValidation), validateRequest(updateCollectionValidation), updateCollection);
router.delete("/:id", authenticateToken, validateRequest(deleteCollectionValidation), deleteCollection);

export default router;
