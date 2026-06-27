import Joi from 'joi';

/**
 * Auth Validators — Joi Schemas
 *
 * Defines validation rules for all auth-related request bodies.
 * These schemas are consumed by the generic validationMiddleware,
 * which runs Joi validation and throws ApiError(400) on failure.
 *
 * Password Policy:
 * - Minimum 8 characters, maximum 128 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 digit
 * - At least 1 special character (!@#$%^&* etc.)
 * This is enforced via regex pattern. The regex uses lookaheads:
 *   (?=.*[A-Z])            — at least one uppercase letter
 *   (?=.*[a-z])            — at least one lowercase letter
 *   (?=.*\d)               — at least one digit
 *   (?=.*[!@#$%^&*()...])  — at least one special character
 *   .{8,}                  — total length is 8 or more
 *
 * Why max 128?
 * Prevents hash-DoS: bcrypt operates on up to 72 bytes, but extremely
 * long inputs still waste CPU. Capping at 128 is generous yet safe.
 *
 * Why stripUnknown in the middleware, not here?
 * Schemas define WHAT is valid. The middleware decides HOW to handle
 * unknown fields (strip vs reject). Separation of concerns.
 */

// ─── Shared Field Definitions ────────────────────────────────────

const nameField = Joi.string()
  .trim()
  .min(2)
  .max(50)
  .required()
  .messages({
    'string.empty': 'Name is required',
    'string.min': 'Name must be at least 2 characters',
    'string.max': 'Name cannot exceed 50 characters',
    'any.required': 'Name is required',
  });

const emailField = Joi.string()
  .trim()
  .lowercase()
  .email()
  .required()
  .messages({
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  });

const passwordField = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~])/)
  .required()
  .messages({
    'string.empty': 'Password is required',
    'string.min': 'Password must be at least 8 characters',
    'string.max': 'Password cannot exceed 128 characters',
    'string.pattern.base':
      'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character',
    'any.required': 'Password is required',
  });

const roleField = Joi.string()
  .valid('candidate', 'recruiter')
  .required()
  .messages({
    'any.only': 'Role must be either candidate or recruiter',
    'any.required': 'Role is required',
  });

// ─── Schemas ─────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 */
export const registerSchema = Joi.object({
  name: nameField,
  email: emailField,
  password: passwordField,
  role: roleField,
});

/**
 * POST /api/v1/auth/login
 */
export const loginSchema = Joi.object({
  email: emailField,
  password: Joi.string().required().messages({
    'string.empty': 'Password is required',
    'any.required': 'Password is required',
  }),
});

/**
 * POST /api/v1/auth/forgot-password
 */
export const forgotPasswordSchema = Joi.object({
  email: emailField,
});

/**
 * POST /api/v1/auth/reset-password/:token
 */
export const resetPasswordSchema = Joi.object({
  password: passwordField,
});
