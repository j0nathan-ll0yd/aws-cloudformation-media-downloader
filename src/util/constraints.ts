import Joi from 'joi'
import ytdlCore from 'ytdl-core'

// Custom Joi extension for YouTube URL validation
const joiYouTubeURL = Joi.extend((joi) => ({
  type: 'youtubeUrl',
  base: joi.string(),
  messages: {
    'youtubeUrl.invalid': '{{#label}} must be a valid YouTube URL'
  },
  validate(value, helpers) {
    if (!ytdlCore.validateURL(value)) {
      return {value, errors: helpers.error('youtubeUrl.invalid')}
    }
    return {value} // Add this line to return a value when validation passes
  }
}))

export const feedlyEventSchema = Joi.object({
  articleURL: joiYouTubeURL.youtubeUrl().required()
})

export const registerDeviceSchema = Joi.object({
  token: Joi.string().required()
})

export const userSubscribeSchema = Joi.object({
  endpointArn: Joi.string().required(),
  topicArn: Joi.string().required()
})

export const registerUserSchema = Joi.object({
  authorizationCode: Joi.string().required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required()
})

export const loginUserSchema = Joi.object({
  authorizationCode: Joi.string().required()
})

// Helper function to validate data against a schema
export const validateSchema = (schema: Joi.ObjectSchema, data: unknown) => {
  const {error} = schema.validate(data, {abortEarly: false})
  if (error) {
    const errors = error.details.map((detail) => ({
      attribute: detail.path.join('.'),
      error: detail.message
    }))
    return {errors}
  }
  return null
}
