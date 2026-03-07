export const validateRequest = (schema) => {
  return async (req, res, next) => {
    try {
      // Only validate the parts that are defined in the schema
      const validationData = {};

      if (schema.describe().keys.body) {
        validationData.body = req.body;
      }
      if (schema.describe().keys.query) {
        validationData.query = req.query;
      }
      if (schema.describe().keys.params) {
        validationData.params = req.params;
      }

      await schema.validateAsync(validationData, { allowUnknown: true });
      next();
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
  };
};
