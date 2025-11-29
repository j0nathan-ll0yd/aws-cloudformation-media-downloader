import Joi from 'joi'
import {logInfo} from './lambda-helpers'

export const feedlyEventSchema = Joi.object({
  articleURL: Joi.string().required().pattern(new RegExp('^((?:https?:)?\\/\\/)?((?:www|m)\\.)?((?:youtube(?:-nocookie)?\\.com|youtu.be))(\\/(?:[\\w\\-]+\\?v=|embed\\/|live\\/|v\\/)?)([\\w\\-]+)(\\S+)?$')).message('is not a valid YouTube URL')
})

export const registerDeviceSchema = Joi.object({
  token: Joi.string().required()
})

export const userSubscribeSchema = Joi.object({
  endpointArn: Joi.string().required(),
  topicArn: Joi.string().required()
})

export const registerUserSchema = Joi.object({
  idToken: Joi.string().required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required()
})

export const loginUserSchema = Joi.object({
  idToken: Joi.string().required()
})

// Helper function to validate data against a schema
export const validateSchema = (schema: Joi.ObjectSchema, data: unknown) => {
  const options = \{
    abortEarly: false,
    allowUnknown: true,
    errors: \{
      wrap: \{
        label: ''
      \}
    \}
  \}

  const {error\} = schema.validate(data, options)
  if (error) \{
    const errorHash: \{[key: string]: [string]\} = \{\}
    error.details.map((detail) =\> \{
      logInfo('Error detail', detail)
      const label = detail.context?.label ?? 'unknown'
      if (!errorHash[label]) \{
        errorHash[label] = [detail.message]
      \} else \{
        errorHash[label].push(detail.message)
      \}
    \})
    return \{errors: errorHash\}
  \}
  return null
}
