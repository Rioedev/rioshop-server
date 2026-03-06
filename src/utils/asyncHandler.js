import { HTTP_STATUS } from "../config/constants.js";

/**
 * Async handler wrapper to catch errors from async controllers
 * Eliminates need for try-catch in every controller
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(statusCode, message, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.data = null;
  }
}

/**
 * Throw API error with consistent format
 */
export const throwError = (statusCode, message, errors = []) => {
  throw new ApiError(statusCode, message, errors);
};

/**
 * Validate and throw error if validation fails
 */
export const throwValidationError = (joiError) => {
  const errors = joiError.details.map((detail) => ({
    field: detail.path.join("."),
    message: detail.message,
  }));
  throwError(HTTP_STATUS.UNPROCESSABLE_ENTITY, "Validation failed", errors);
};
