import Blog from "../models/Blog.js";

export class BlogService {
  async getAllBlogs(filters = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      sort = { publishedAt: -1, createdAt: -1 },
    } = options;

    const queryFilters = {
      deletedAt: null,
      ...filters,
    };

    return Blog.paginate(queryFilters, {
      page,
      limit,
      sort,
    });
  }

  async getBlogBySlug(slug, { publishedOnly = false } = {}) {
    const filters = {
      slug,
      deletedAt: null,
    };

    if (publishedOnly) {
      filters.isPublished = true;
      filters.publishedAt = { $lte: new Date() };
    }

    return Blog.findOne(filters);
  }

  async getBlogById(id) {
    return Blog.findOne({
      _id: id,
      deletedAt: null,
    });
  }

  async createBlog(data) {
    const blog = new Blog(data);
    return blog.save();
  }

  async updateBlog(id, data) {
    return Blog.findOneAndUpdate(
      {
        _id: id,
        deletedAt: null,
      },
      data,
      { new: true },
    );
  }

  async deleteBlog(id) {
    return Blog.findOneAndUpdate(
      {
        _id: id,
        deletedAt: null,
      },
      {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
      { new: true },
    );
  }
}

export default new BlogService();
