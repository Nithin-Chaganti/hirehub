import ApiError from '../utils/ApiError.js';

/**
 * Validation Middleware Factory
 *
 * Creates an Express middleware that validates the request body (or params/query)
 * against a Joi schema. If validation fails, it throws an ApiError(400) with
 * field-level error details that the error middleware formats into the standard
 * error response shape.
 *
 * Usage in routes:
 *   import validate from '../middleware/validationMiddleware.js';
 *   import { registerSchema } from '../validators/authValidator.js';
 *
 *   router.post('/register', validate(registerSchema), authController.register);
 *
 * Why a factory function?
 * Because different routes need different schemas. The factory takes a schema
 * and returns a middleware tailored to that schema. Clean, composable, DRY.
 *
 * Why stripUnknown?
 * If the client sends extra fields (e.g., isAdmin: true), Joi silently strips
 * them. This prevents mass-assignment attacks without rejecting the request.
 *
 * Why abortEarly: false?
 * By default, Joi stops at the first error. Setting abortEarly to false
 * collects ALL errors so the client can fix them in one go instead of
 * playing error whack-a-mole.
 *
 * @param {import('joi').Schema} schema  — Joi schema to validate against
 * @param {string} source               — Request property to validate ('body', 'params', 'query')
 * @returns {Function} Express middleware
 */
const validate = (schema, source = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: false,     // Collect all errors, not just the first
    stripUnknown: true,    // Remove fields not in the schema
  });

  if (error) {
    // Transform Joi's error.details into our standard error shape
    const errors = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));

    throw new ApiError(400, 'Validation Error', errors);
  }

  // Replace the raw input with the validated + sanitized value
  req[source] = value;
  next();
};

export default validate;
