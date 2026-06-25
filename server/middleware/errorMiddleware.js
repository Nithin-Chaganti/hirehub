import config from '../config/env.js';

/**
 * Global Error Handling Middleware
 *
 * The LAST middleware registered in app.js. Every error in the application
 * flows through this single handler, giving us:
 * 1. Consistent error response format across all endpoints
 * 2. Single place for error logging
 * 3. Stack trace hiding in production (never leak internals to clients)
 *
 * Error types handled:
 * - ApiError: Our custom errors thrown from services/controllers
 * - Mongoose ValidationError: Schema validation failures
 * - Mongoose CastError: Invalid ObjectId format
 * - JWT JsonWebTokenError: Malformed token
 * - JWT TokenExpiredError: Expired token
 * - MongoDB 11000: Duplicate key (unique constraint violation)
 * - Everything else: Generic 500 Internal Server Error
 *
 * Interview Tip: "Every error passes through a centralized error middleware.
 * This gives us consistent responses, a single logging point, and prevents
 * leaking stack traces to clients in production."
 */

// eslint-disable-next-line no-unused-vars
const errorMiddleware = (err, req, res, next) => {
  // Default values — overridden below based on error type
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || [];

  // ─── Error Type Detection (mutually exclusive — use if/else-if) ───
  //
  // Each error type is unique, so we use an if/else-if chain instead of
  // independent if blocks. This avoids unnecessary checks after a match
  // is found and prevents accidental fall-through overwrites.

  if (err.name === 'ValidationError') {
    // ─── Mongoose Validation Error ──────────────────────────────
    // Thrown when a document fails Mongoose schema validation
    // e.g., required field missing, enum value invalid
    statusCode = 400;
    message = 'Validation Error';
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  } else if (err.name === 'CastError') {
    // ─── Mongoose Cast Error ────────────────────────────────────
    // Thrown when an invalid ObjectId is passed (e.g., /jobs/not-a-valid-id)
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
    errors = [];
  } else if (err.code === 11000) {
    // ─── MongoDB Duplicate Key Error ────────────────────────────
    // Error code 11000 — thrown when a unique index constraint is violated
    // e.g., registering with an email that already exists
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    errors = [{ field, message }];
  } else if (err.name === 'JsonWebTokenError') {
    // ─── JWT Malformed Token ────────────────────────────────────
    statusCode = 401;
    message = 'Invalid token';
    errors = [];
  } else if (err.name === 'TokenExpiredError') {
    // ─── JWT Expired Token ──────────────────────────────────────
    statusCode = 401;
    message = 'Token expired';
    errors = [];
  }

  // ─── Log the Error ──────────────────────────────────────────
  if (config.NODE_ENV === 'development') {
    console.error('─── Error ───────────────────────────────────');
    console.error(`Status: ${statusCode}`);
    console.error(`Message: ${message}`);
    if (err.stack) console.error(`Stack: ${err.stack}`);
    console.error('─────────────────────────────────────────────');
  } else {
    // In production, only log unexpected (non-operational) errors
    if (!err.isOperational) {
      console.error('UNEXPECTED ERROR:', err);
    }
  }

  // ─── Send Response ──────────────────────────────────────────
  const response = {
    success: false,
    message,
  };

  // Only include errors array if there are validation errors
  if (errors.length > 0) {
    response.errors = errors;
  }

  // Include stack trace in development for debugging
  if (config.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

export default errorMiddleware;
