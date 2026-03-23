import Review from "../models/Review.js";
import Product from "../models/Product.js";
import notificationService from "./notificationService.js";
import { AppError } from "../utils/helpers.js";

export class ReviewService {
  async getReviewsByProduct(productId, options = {}) {
    const {
      page = 1,
      limit = 10,
      sort = { createdAt: -1 },
      includePending = false,
      includeRejected = false,
    } = options;

    try {
      const query = { productId };

      if (!includePending && !includeRejected) {
        query.status = "approved";
      } else {
        const statuses = ["approved"];
        if (includePending) statuses.push("pending");
        if (includeRejected) statuses.push("rejected");
        query.status = { $in: statuses };
      }

      const [reviews, stats] = await Promise.all([
        Review.paginate(query, {
          page,
          limit,
          sort,
          populate: [
            { path: "userId", select: "_id fullName avatar" },
            { path: "productId", select: "_id name slug" },
          ],
        }),
        this.getReviewStats(productId),
      ]);

      return {
        ...reviews,
        stats,
      };
    } catch (error) {
      throw error;
    }
  }

  async createReview(userId, data, isAdmin = false) {
    try {
      const existing = await Review.findOne({
        userId,
        productId: data.productId,
        orderId: data.orderId,
      });

      if (existing) {
        throw new AppError("You have already reviewed this product for the order", 409);
      }

      const review = new Review({
        ...data,
        userId,
        status:
          isAdmin && ["pending", "approved", "rejected"].includes(data.status)
            ? data.status
            : "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await review.save();

      if (review.status === "approved") {
        await this.syncProductRatings(review.productId);
      }

      return review;
    } catch (error) {
      throw error;
    }
  }

  async updateReview(reviewId, userId, data = {}, isAdmin = false) {
    try {
      const query = { _id: reviewId };
      if (!isAdmin) {
        query.userId = userId;
      }

      const review = await Review.findOne(query);
      if (!review) {
        throw new AppError("Review not found", 404);
      }

      const previousStatus = review.status;
      const previousRating = review.rating;
      const previousAdminReplyBody = review.adminReply?.body?.toString().trim() || "";

      const allowedFields = isAdmin
        ? [
            "rating",
            "title",
            "body",
            "media",
            "fit",
            "quality",
            "status",
            "adminReply",
            "reported",
          ]
        : ["rating", "title", "body", "media", "fit", "quality"];

      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          review[field] = data[field];
        }
      }

      review.updatedAt = new Date();
      await review.save();

      if (
        review.status !== previousStatus ||
        review.rating !== previousRating ||
        review.status === "approved"
      ) {
        await this.syncProductRatings(review.productId);
      }

      if (isAdmin) {
        const nextAdminReplyBody = review.adminReply?.body?.toString().trim() || "";
        if (nextAdminReplyBody && nextAdminReplyBody !== previousAdminReplyBody) {
          void this.notifyReviewReply(review._id);
        }
      }

      return review;
    } catch (error) {
      throw error;
    }
  }

  async deleteReview(reviewId, userId = null, isAdmin = false) {
    try {
      const query = { _id: reviewId };
      if (!isAdmin && userId) {
        query.userId = userId;
      }

      const review = await Review.findOneAndDelete(query);
      if (!review) {
        throw new AppError("Review not found", 404);
      }

      await this.syncProductRatings(review.productId);
      return review;
    } catch (error) {
      throw error;
    }
  }

  async moderateReview(reviewId, status, adminReply = null, adminId = null) {
    try {
      if (!["approved", "rejected", "pending"].includes(status)) {
        throw new AppError("Invalid review status", 400);
      }

      const payload = {
        status,
      };

      if (adminReply) {
        payload.adminReply = {
          body: adminReply,
          repliedAt: new Date(),
          adminId,
        };
      }

      const review = await Review.findByIdAndUpdate(reviewId, payload, {
        new: true,
      });

      if (!review) {
        throw new AppError("Review not found", 404);
      }

      await this.syncProductRatings(review.productId);
      if (adminReply) {
        void this.notifyReviewReply(review._id);
      }
      return review;
    } catch (error) {
      throw error;
    }
  }

  async getReviewStats(productId) {
    try {
      const approvedReviews = await Review.find({
        productId,
        status: "approved",
      }).select("rating");

      const count = approvedReviews.length;
      const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      let sum = 0;

      for (const review of approvedReviews) {
        const star = Math.round(Number(review.rating || 0));
        if (dist[star] !== undefined) {
          dist[star] += 1;
        }
        sum += Number(review.rating || 0);
      }

      return {
        count,
        avg: count > 0 ? Number((sum / count).toFixed(2)) : 0,
        dist,
      };
    } catch (error) {
      throw error;
    }
  }

  async syncProductRatings(productId) {
    try {
      const stats = await this.getReviewStats(productId);

      await Product.findByIdAndUpdate(productId, {
        "ratings.avg": stats.avg,
        "ratings.count": stats.count,
        "ratings.dist.5": stats.dist[5],
        "ratings.dist.4": stats.dist[4],
        "ratings.dist.3": stats.dist[3],
        "ratings.dist.2": stats.dist[2],
        "ratings.dist.1": stats.dist[1],
        updatedAt: new Date(),
      });
    } catch (error) {
      throw error;
    }
  }

  async notifyReviewReply(reviewId) {
    try {
      const review = await Review.findById(reviewId)
        .select("userId productId adminReply")
        .populate([{ path: "productId", select: "name slug" }]);

      if (!review || !review.adminReply?.body) {
        return;
      }

      await notificationService.notifyReviewReply(review);
    } catch {
      // Do not block review update flow due to notification error.
    }
  }
}

export default new ReviewService();
