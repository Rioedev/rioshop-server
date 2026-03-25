import express from "express";
import {
  createBlog,
  deleteBlog,
  getAllBlogs,
  getBlogBySlug,
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

// Public routes
router.get("/", validateRequest(listBlogsValidation), getAllBlogs);
router.get("/:slug", getBlogBySlug);

// Admin routes
router.post("/", validateRequest(createBlogValidation), createBlog);
router.put("/:id", validateRequest(updateBlogValidation), updateBlog);
router.delete("/:id", validateRequest(deleteBlogValidation), deleteBlog);

export default router;
