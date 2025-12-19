/**
 * Environment variable validation utilities
 * Provides fail-fast validation at Lambda cold start
 */

export class MissingEnvVarError extends Error {
  constructor(name: string) {
    super(`Missing required environment variable: ${name}`)
    this.name = 'MissingEnvVarError'
  }
}

/**
 * Gets a required environment variable or throws an error
 * Use this at cold start to fail fast if configuration is missing
 * @param name - Environment variable name
 * @returns The environment variable value
 * @throws MissingEnvVarError if the variable is not set
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new MissingEnvVarError(name)
  }
  return value
}

/**
 * Gets an optional environment variable with a default value
 * @param name - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns The environment variable value or default
 */
export function getOptionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue
}

/**
 * Gets a required numeric environment variable
 * @param name - Environment variable name
 * @returns The parsed number
 * @throws MissingEnvVarError if the variable is not set
 * @throws Error if the value is not a valid number
 */
export function getRequiredEnvNumber(name: string): number {
  const value = getRequiredEnv(name)
  const parsed = parseInt(value, 10)
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} is not a valid number: ${value}`)
  }
  return parsed
}

/**
 * Gets an optional numeric environment variable with a default value
 * @param name - Environment variable name
 * @param defaultValue - Default value if not set or invalid
 * @returns The parsed number or default value
 */
export function getOptionalEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name]
  if (!value) {
    return defaultValue
  }
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}
