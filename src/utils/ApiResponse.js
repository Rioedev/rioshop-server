import { HTTP_STATUS } from "../config/constants.js";

/**
 * Unified API Response formatter
 * Ensures consistent response structure across all endpoints
 */
class ApiResponse {
  /**
   * Send success response
   * @param {Object} res - Express response object
   * @param {*} data - Response data
   * @param {String} message - Success message
   * @param {Number} status - HTTP status code
   */
  static success(
    res,
    data = null,
    message = "Success",
    status = HTTP_STATUS.OK,
  ) {
    return res.status(status).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send created response (201)
   * @param {Object} res - Express response object
   * @param {*} data - Created resource data
   * @param {String} message - Success message
   */
  static created(res, data = null, message = "Created successfully") {
    return this.success(res, data, message, HTTP_STATUS.CREATED);
  }

  /**
   * Send error response
   * @param {Object} res - Express response object
   * @param {String} message - Error message
   * @param {Number} status - HTTP status code
   * @param {Array} errors - Detailed errors
   */
  static error(
    res,
    message = "Error",
    status = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errors = [],
  ) {
    return res.status(status).json({
      success: false,
      message,
      ...(errors.length > 0 && { errors }),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send 400 Bad Request error
   */
  static badRequest(res, message = "Bad request", errors = []) {
    return this.error(res, message, HTTP_STATUS.BAD_REQUEST, errors);
  }

  /**
   * Send 401 Unauthorized error
   */
  static unauthorized(res, message = "Unauthorized") {
    return this.error(res, message, HTTP_STATUS.UNAUTHORIZED);
  }

  /**
   * Send 403 Forbidden error
   */
  static forbidden(res, message = "Forbidden") {
    return this.error(res, message, HTTP_STATUS.FORBIDDEN);
  }

  /**
   * Send 404 Not Found error
   */
  static notFound(res, message = "Not found") {
    return this.error(res, message, HTTP_STATUS.NOT_FOUND);
  }

  /**
   * Send 409 Conflict error
   */
  static conflict(res, message = "Conflict") {
    return this.error(res, message, HTTP_STATUS.CONFLICT);
  }
}

export default ApiResponse;
