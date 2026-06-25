/**
 * Custom API Error Class
 *
 * Extends the native Error class to include:
 * - statusCode: HTTP status code (400, 401, 403, 404, 409, 500, etc.)
 * - errors: Array of field-level validation errors
 * - isOperational: Distinguishes expected errors (bad input, auth failure)
 *   from programmer bugs (null reference, syntax error).
 *   The error middleware uses this to decide whether to expose
 *   the error message to the client or return a generic 500.
 *
 * Usage in services:
 *   throw new ApiError(404, 'Job not found');
 *   throw new ApiError(400, 'Validation failed', [{ field: 'email', message: 'Invalid format' }]);
 */
class ApiError extends Error {
  constructor(statusCode, message = 'Something went wrong', errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;

    // Capture the stack trace, excluding the constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;
