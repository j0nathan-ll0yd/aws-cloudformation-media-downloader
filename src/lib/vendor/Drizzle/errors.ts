/**
 * Drizzle Query Error Types
 *
 * Provides typed wrappers for PostgreSQL error codes to enable consistent
 * error handling across the entity layer.
 *
 * @see {@link https://www.postgresql.org/docs/current/errcodes-appendix.html | PostgreSQL Error Codes}
 */

/**
 * PostgreSQL error codes for common constraint violations.
 */
export enum PostgresErrorCode {
  /** Unique constraint violation (duplicate key) */
  UniqueViolation = '23505',
  /** Foreign key constraint violation (referenced row not found) */
  ForeignKeyViolation = '23503',
  /** Not null constraint violation (required field missing) */
  NotNullViolation = '23502',
  /** Check constraint violation */
  CheckViolation = '23514',
  /** Serialization failure (transaction conflict, retry needed) */
  SerializationFailure = '40001'
}

/**
 * Typed query error with PostgreSQL error code information.
 *
 * Use this to wrap database errors for consistent handling:
 * ```typescript
 * try {
 *   await db.insert(users).values(data)
 * } catch (error) {
 *   if (isDatabaseError(error)) {
 *     const queryError = QueryError.fromDatabaseError(error)
 *     if (queryError.isUniqueViolation()) {
 *       // Handle duplicate
 *     }
 *   }
 *   throw error
 * }
 * ```
 */
export class QueryError extends Error {
  override readonly name = 'QueryError'

  constructor(message: string, public readonly code: PostgresErrorCode | string, public readonly cause?: Error) {
    super(message)
  }

  /**
   * Creates a QueryError from a postgres DatabaseError.
   */
  static fromDatabaseError(error: DatabaseErrorLike): QueryError {
    return new QueryError(error.message, error.code ?? 'UNKNOWN', error)
  }

  /**
   * Checks if the error is a unique constraint violation (duplicate key).
   */
  isUniqueViolation(): boolean {
    return this.code === PostgresErrorCode.UniqueViolation
  }

  /**
   * Checks if the error is a foreign key constraint violation.
   */
  isForeignKeyViolation(): boolean {
    return this.code === PostgresErrorCode.ForeignKeyViolation
  }

  /**
   * Checks if the error is a not null constraint violation.
   */
  isNotNullViolation(): boolean {
    return this.code === PostgresErrorCode.NotNullViolation
  }

  /**
   * Checks if the error is a serialization failure (needs retry).
   */
  isSerializationFailure(): boolean {
    return this.code === PostgresErrorCode.SerializationFailure
  }
}

/**
 * Interface matching postgres package DatabaseError shape.
 * Using interface to avoid runtime dependency on postgres types.
 */
interface DatabaseErrorLike extends Error {
  code?: string
  detail?: string
  constraint?: string
  table?: string
  column?: string
}

/**
 * Type guard to check if an error is a DatabaseError from the postgres package.
 * @param error - The error to check
 * @returns True if the error has a PostgreSQL error code
 */
export function isDatabaseError(error: unknown): error is DatabaseErrorLike {
  return error instanceof Error && 'code' in error && typeof (error as DatabaseErrorLike).code === 'string'
}

/**
 * Wraps a database operation with consistent error handling.
 * Converts postgres errors to QueryError for typed handling.
 *
 * @param operation - The database operation to execute
 * @returns The result of the operation
 * @throws QueryError if a database error occurs
 */
export async function withQueryError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (isDatabaseError(error)) {
      throw QueryError.fromDatabaseError(error)
    }
    throw error
  }
}
