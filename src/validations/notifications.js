import Joi from "joi";

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

export const getNotificationsValidation = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    unreadOnly: Joi.boolean().truthy("true").falsy("false").optional(),
  }).required(),
});

export const notificationIdValidation = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }).required(),
});
