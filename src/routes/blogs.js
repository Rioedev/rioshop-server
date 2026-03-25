import express from "express";
import multer from "multer";
import {
  createBlog,
  deleteBlog,
  getAllBlogs,
  getBlogBySlug,
  uploadBlogImage,
  updateBlog,
} from "../controllers/blogController.js";
import { validateRequest } from "../middlewares/validation.js";
import {
  createBlogValidation,
  deleteBlogValidation,
  listBlogsValidation,
  updateBlogValidation,
} from "../validations/blogs.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

// Public routes
router.get("/", validateRequest(listBlogsValidation), getAllBlogs);
router.get("/:slug", getBlogBySlug);

// Admin routes
router.post("/upload-image", upload.single("file"), uploadBlogImage);
router.post("/", validateRequest(createBlogValidation), createBlog);
router.put("/:id", validateRequest(updateBlogValidation), updateBlog);
router.delete("/:id", validateRequest(deleteBlogValidation), deleteBlog);

export default router;
