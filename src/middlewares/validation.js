export const validateRequest = (schema) => {
  return async (req, res, next) => {
    try {
      await schema.validateAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.details[0].message,
      })
    }
  }
};