import Collection from "../models/Collection.js";

export class CollectionService {
  async getAllCollections(filters = {}, options = {}) {
    const { page = 1, limit = 10, sort = { position: 1, name: 1 } } = options;

    try {
      const queryFilters = {
        deletedAt: null,
        ...filters,
      };

      return await Collection.paginate(queryFilters, {
        page,
        limit,
        sort,
      });
    } catch (error) {
      throw error;
    }
  }

  async getCollectionBySlug(slug) {
    try {
      return await Collection.findOne({
        slug,
        isActive: true,
        deletedAt: null,
      });
    } catch (error) {
      throw error;
    }
  }

  async getCollectionById(id) {
    try {
      return await Collection.findOne({
        _id: id,
        deletedAt: null,
      });
    } catch (error) {
      throw error;
    }
  }

  async createCollection(data) {
    try {
      const collection = new Collection(data);
      await collection.save();
      return collection;
    } catch (error) {
      throw error;
    }
  }

  async updateCollection(id, data) {
    try {
      return await Collection.findOneAndUpdate(
        { _id: id, deletedAt: null },
        data,
        { new: true },
      );
    } catch (error) {
      throw error;
    }
  }

  async deleteCollection(id) {
    try {
      return await Collection.findOneAndUpdate(
        { _id: id, deletedAt: null },
        {
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
        { new: true },
      );
    } catch (error) {
      throw error;
    }
  }

  async searchCollections(query, filters = {}, options = {}) {
    const { page = 1, limit = 10 } = options;

    try {
      const searchQuery = {
        deletedAt: null,
        ...filters,
        $or: [
          { name: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
          { slug: { $regex: query, $options: "i" } },
        ],
      };

      return await Collection.paginate(searchQuery, {
        page,
        limit,
      });
    } catch (error) {
      throw error;
    }
  }
}

export default new CollectionService();
