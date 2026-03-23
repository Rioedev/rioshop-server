import rateLimit from 'express-rate-limit';

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const max = Number(process.env.RATE_LIMIT_MAX || 300);

const rateLimiter = rateLimit({
  windowMs,
  max,
  message: 'Quá nhiều yêu cầu từ địa chỉ IP này, vui lòng thử lại sau 15 phút',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // During local development we disable rate-limit to avoid blocking QA flow.
    if (process.env.NODE_ENV !== "production") {
      return true;
    }

    if (req.path === "/health") {
      return true;
    }

    // Socket.IO can keep long-lived/reconnect traffic, avoid accidental 429.
    if (req.path.startsWith("/socket.io")) {
      return true;
    }

    return false;
  }
});

export default rateLimiter;
