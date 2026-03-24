import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { redisClient } from "../config/redis.js";

dotenv.config();

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Không tìm thấy token, vui lòng đăng nhập để tiếp tục",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Optional blacklist check (gracefully skipped when Redis is unavailable)
    const principalId = decoded.userId || decoded.adminId;
    if (principalId && redisClient?.isOpen) {
      try {
        const blacklistKey = `blacklist:${principalId}`;
        const blacklistedToken = await redisClient.get(blacklistKey);

        if (blacklistedToken === token) {
          return res.status(403).json({
            success: false,
            message: "Token không hợp lệ hoặc hết hạn",
          });
        }
      } catch (error) {
        // Ignore Redis errors to avoid blocking authentication flow.
      }
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: "Token không hợp lệ hoặc hết hạn",
    });
  }
};

export const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Người dùng chưa được xác thực",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Quyền truy cập không đủ",
      });
    }

    next();
  };
};

export const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};
