/**
 * Enterprise Error Handling
 *
 * Provides structured error responses with:
 * - Error codes for client-side handling
 * - Reference IDs for log correlation
 * - Safe messages that don't expose internals
 */

// ============================================================================
// ERROR CODES
// ============================================================================

/**
 * Standardised error codes for API responses.
 * Clients can switch on these codes for programmatic error handling.
 */
export const ErrorCode = {
  // Authentication & Authorisation (1xxx)
  UNAUTHORIZED: 'ERR_1001',
  FORBIDDEN: 'ERR_1002',
  TOKEN_EXPIRED: 'ERR_1003',

  // Validation (2xxx)
  VALIDATION_FAILED: 'ERR_2001',
  MISSING_REQUIRED_FIELD: 'ERR_2002',
  INVALID_FORMAT: 'ERR_2003',
  INVALID_ACTION: 'ERR_2004',

  // Resource (3xxx)
  NOT_FOUND: 'ERR_3001',
  ALREADY_EXISTS: 'ERR_3002',
  GONE: 'ERR_3003',

  // Conflict (4xxx)
  CONFLICT: 'ERR_4001',
  VERSION_MISMATCH: 'ERR_4002',
  CONCURRENT_MODIFICATION: 'ERR_4003',

  // Rate Limiting (5xxx)
  RATE_LIMITED: 'ERR_5001',
  QUOTA_EXCEEDED: 'ERR_5002',

  // Server (9xxx)
  INTERNAL_ERROR: 'ERR_9001',
  DATABASE_ERROR: 'ERR_9002',
  EXTERNAL_SERVICE_ERROR: 'ERR_9003',
  TIMEOUT: 'ERR_9004',
} as const

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode]

// ============================================================================
// ERROR RESPONSE STRUCTURE
// ============================================================================

/**
 * Standardised error response format.
 * All API errors conform to this structure.
 */
export interface ErrorResponse {
  success: false
  error: {
    code: ErrorCodeType
    message: string
    reference: string
    details?: Record<string, unknown>
  }
}

// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

/**
 * Base class for all application errors.
 * Provides structured error information for consistent handling.
 */
export abstract class AppError extends Error {
  abstract readonly code: ErrorCodeType
  abstract readonly statusCode: number
  readonly details?: Record<string, unknown>
  readonly reference: string

  constructor(message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = this.constructor.name
    this.details = details
    this.reference = generateReferenceId()

    // Maintains proper stack trace in V8 environments (Node.js, Cloudflare Workers)
    const ErrorWithCapture = Error as typeof Error & {
      captureStackTrace?: (target: object, constructor?: new (...args: unknown[]) => unknown) => void
    }
    if (typeof ErrorWithCapture.captureStackTrace === 'function') {
      ErrorWithCapture.captureStackTrace(this, this.constructor as new (...args: unknown[]) => unknown)
    }
  }

  /**
   * Returns a safe error response suitable for client consumption.
   * Internal details are logged server-side but not exposed.
   */
  toResponse(): ErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        reference: this.reference,
        details: this.details,
      },
    }
  }
}

/**
 * Authentication or authorisation failure.
 */
export class UnauthorizedError extends AppError {
  readonly code = ErrorCode.UNAUTHORIZED
  readonly statusCode = 401

  constructor(message = 'Authentication required') {
    super(message)
  }
}

/**
 * Request validation failure.
 */
export class ValidationError extends AppError {
  readonly code = ErrorCode.VALIDATION_FAILED
  readonly statusCode = 400
}

/**
 * Missing required field in request.
 */
export class MissingFieldError extends AppError {
  readonly code = ErrorCode.MISSING_REQUIRED_FIELD
  readonly statusCode = 400

  constructor(fieldName: string) {
    super(`Missing required field: ${fieldName}`, { field: fieldName })
  }
}

/**
 * Invalid action for the given context.
 */
export class InvalidActionError extends AppError {
  readonly code = ErrorCode.INVALID_ACTION
  readonly statusCode = 400

  constructor(action: string, context?: string) {
    super(context ? `Invalid action '${action}' for ${context}` : `Invalid action: ${action}`, {
      action,
      context,
    })
  }
}

/**
 * Requested resource not found.
 */
export class NotFoundError extends AppError {
  readonly code = ErrorCode.NOT_FOUND
  readonly statusCode = 404

  constructor(resourceType: string, identifier?: string) {
    super(identifier ? `${resourceType} not found: ${identifier}` : `${resourceType} not found`, {
      resourceType,
      identifier,
    })
  }
}

/**
 * Conflict due to concurrent modification (optimistic locking).
 */
export class ConflictError extends AppError {
  readonly code = ErrorCode.VERSION_MISMATCH
  readonly statusCode = 409

  constructor(
    message: string,
    details: {
      serverVersion: number
      clientVersion: number
      lastModifiedBy?: string
      lastModifiedAt?: string
    },
  ) {
    super(message, {
      server_version: details.serverVersion,
      client_version: details.clientVersion,
      last_modified_by: details.lastModifiedBy,
      last_modified_at: details.lastModifiedAt,
    })
  }
}

/**
 * Method not allowed for the endpoint.
 */
export class MethodNotAllowedError extends AppError {
  readonly code = ErrorCode.INVALID_ACTION
  readonly statusCode = 405

  constructor(method: string, allowedMethods?: string[]) {
    super(`Method ${method} not allowed`, {
      method,
      allowed: allowedMethods,
    })
  }
}

/**
 * Internal server error - details logged but not exposed.
 */
export class InternalError extends AppError {
  readonly code = ErrorCode.INTERNAL_ERROR
  readonly statusCode = 500
  readonly internalMessage: string

  constructor(internalMessage: string, publicMessage = 'An unexpected error occurred') {
    super(publicMessage)
    this.internalMessage = internalMessage
  }
}

/**
 * Database operation failure.
 */
export class DatabaseError extends AppError {
  readonly code = ErrorCode.DATABASE_ERROR
  readonly statusCode = 500
  readonly internalMessage: string

  constructor(internalMessage: string) {
    super('A database error occurred. Please try again.')
    this.internalMessage = internalMessage
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generates a unique reference ID for error tracking.
 * Format: ERR-{timestamp}-{random}
 */
function generateReferenceId(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `ERR-${timestamp}-${random}`
}

/**
 * Wraps an unknown error into an appropriate AppError.
 * Logs the original error details and returns a safe version.
 */
export function wrapError(error: unknown, context?: string): AppError {
  // Already an AppError - return as-is
  if (error instanceof AppError) {
    return error
  }

  // Standard Error object
  if (error instanceof Error) {
    const internalMessage = context ? `${context}: ${error.message}` : error.message
    return new InternalError(internalMessage)
  }

  // Unknown error type
  const internalMessage = context ? `${context}: ${String(error)}` : String(error)
  return new InternalError(internalMessage)
}

/**
 * Logs error details server-side.
 * Includes full context for debugging without exposing to clients.
 */
export function logError(error: AppError, additionalContext?: Record<string, unknown>): void {
  const logEntry = {
    reference: error.reference,
    code: error.code,
    message: error.message,
    name: error.name,
    timestamp: new Date().toISOString(),
    ...additionalContext,
  }

  // Include internal message for InternalError and DatabaseError
  if ('internalMessage' in error) {
    Object.assign(logEntry, { internalMessage: (error as InternalError).internalMessage })
  }

  console.error('[ERROR]', JSON.stringify(logEntry))
}

/**
 * Creates an error response with proper HTTP status and CORS headers.
 */
export function errorResponse(error: AppError, corsHeaders: Record<string, string>): Response {
  logError(error)

  return new Response(JSON.stringify(error.toResponse()), {
    status: error.statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })
}
