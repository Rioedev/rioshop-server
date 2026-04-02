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
router.post("/upload-image", upload.single("file"), uploadCollectionImage);
router.get("/id/:id", validateRequest(getCollectionByIdValidation), getCollectionById);
router.get("/:slug", getCollectionBySlug);

router.post("/", validateRequest(createCollectionValidation), createCollection);
router.put("/:id", validateRequest(getCollectionByIdValidation), validateRequest(updateCollectionValidation), updateCollection);
router.delete("/:id", validateRequest(deleteCollectionValidation), deleteCollection);

export default router;
