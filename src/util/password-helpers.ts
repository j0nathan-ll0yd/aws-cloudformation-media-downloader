import {scrypt, randomBytes, timingSafeEqual} from 'crypto'
import {promisify} from 'util'

const scryptAsync = promisify(scrypt)

const SALT_LENGTH = 16
const KEY_LENGTH = 64

/**
 * Hashes a password using scrypt
 * @param password - Plain text password to hash
 * @returns Hashed password with salt (format: salt:hash)
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString('hex')
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

/**
 * Verifies a password against a hash
 * @param password - Plain text password to verify
 * @param hash - Stored hash (format: salt:hash)
 * @returns True if password matches, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, storedHash] = hash.split(':')
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
  const storedBuffer = Buffer.from(storedHash, 'hex')

  return timingSafeEqual(derivedKey, storedBuffer)
}
