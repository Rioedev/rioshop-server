// Response Formatter
export const sendSuccess = (
  res,
  statusCode = 200,
  data = null,
  message = "Success",
) => {
  res.status(statusCode).json({
    success: true,
    statusCode,
    message,
    data,
  });
};

export const sendError = (
  res,
  statusCode = 500,
  message = "Internal Server Error",
  data = null,
) => {
  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    ...(data && { data }),
  });
};

// Pagination Helper
export const getPaginationParams = (page = 1, limit = 10) => {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 10));
  return {
    page: pageNum,
    limit: limitNum,
    skip: (pageNum - 1) * limitNum,
  };
};

// Error class
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Async handler
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
