import { HTTP_STATUS, VALIDATION_CONFIG } from "../config/constants.js";

/**
 * Shared validation middleware factory
 * Parses JSON strings from FormData and validates using Joi schema
 */
export const createValidationMiddleware = (schema) => {
  return (req, res, next) => {
    try {
      // Parse JSON strings from FormData before validation
      const payload = { ...req.body };

      // Parse predefined JSON fields
      VALIDATION_CONFIG.JSON_FIELDS.forEach((field) => {
        if (typeof payload[field] === "string") {
          try {
            payload[field] = JSON.parse(payload[field]);
          } catch (e) {
            // Ignore parsing errors here, Joi will catch invalid structures
          }
        }
      });

      // Validate payload against schema
      const { error, value } = schema.validate(payload, { abortEarly: false });

      if (error) {
        const messages = error.details
          .map((d) => `${d.path.join(".")}: ${d.message}`)
          .join(", ");
        return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({
          success: false,
          message: "Validation failed",
          details: error.details,
        });
      }

      // Replace request body with validated value
      req.body = value;
      next();
    } catch (error) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Validation error",
      });
    }
  };
};
