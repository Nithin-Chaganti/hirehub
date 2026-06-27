import Joi from 'joi';

/**
 * User Validators — Joi Schemas
 *
 * Defines validation rules for user profile and password endpoints.
 * These schemas are consumed by the generic validationMiddleware.
 *
 * Design Notes:
 * - Profile schemas make all fields optional (PATCH-style update via PUT)
 * - Password schema reuses the same strength rules as registration
 * - Immutable fields (email, role, passwordHash) are NOT in the schemas,
 *   and stripUnknown in the middleware will silently remove them if sent
 * - Skills are lowercased and trimmed to normalize for search
 */

// ─── Shared Field Definitions ────────────────────────────────────

const nameField = Joi.string()
  .trim()
  .min(2)
  .max(50)
  .messages({
    'string.min': 'Name must be at least 2 characters',
    'string.max': 'Name cannot exceed 50 characters',
  });

const phoneField = Joi.string()
  .trim()
  .pattern(/^\d{10}$/)
  .messages({
    'string.pattern.base': 'Phone must be a 10-digit number',
  });

const bioField = Joi.string()
  .trim()
  .max(500)
  .allow('')
  .messages({
    'string.max': 'Bio cannot exceed 500 characters',
  });

const locationField = Joi.string()
  .trim()
  .max(100)
  .allow('')
  .messages({
    'string.max': 'Location cannot exceed 100 characters',
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

// ─── Experience Sub-Schema ──────────────────────────────────────

const experienceItemSchema = Joi.object({
  company: Joi.string().trim().required().messages({
    'string.empty': 'Company name is required',
    'any.required': 'Company name is required',
  }),
  role: Joi.string().trim().required().messages({
    'string.empty': 'Role is required',
    'any.required': 'Role is required',
  }),
  duration: Joi.string().trim().required().messages({
    'string.empty': 'Duration is required',
    'any.required': 'Duration is required',
  }),
  description: Joi.string().trim().max(500).allow('').messages({
    'string.max': 'Description cannot exceed 500 characters',
  }),
});

// ─── Candidate Profile Schema ────────────────────────────────────

/**
 * PUT /api/v1/users/candidate/profile
 *
 * All fields optional — the user can update any combination.
 * Skills are trimmed and lowercased at the model level.
 */
export const candidateProfileSchema = Joi.object({
  name: nameField,
  phone: phoneField,
  bio: bioField,
  location: locationField,
  skills: Joi.array()
    .items(
      Joi.string().trim().min(1).max(50).messages({
        'string.min': 'Skill cannot be empty',
        'string.max': 'Skill cannot exceed 50 characters',
      })
    )
    .max(20)
    .messages({
      'array.max': 'Cannot have more than 20 skills',
    }),
  experience: Joi.array()
    .items(experienceItemSchema)
    .max(10)
    .messages({
      'array.max': 'Cannot have more than 10 experience entries',
    }),
}).min(1).messages({
  'object.min': 'At least one field is required to update',
});

// ─── Recruiter Profile Schema ────────────────────────────────────

/**
 * PUT /api/v1/users/recruiter/profile
 *
 * Recruiters don't have skills or experience fields.
 */
export const recruiterProfileSchema = Joi.object({
  name: nameField,
  phone: phoneField,
  bio: bioField,
  location: locationField,
}).min(1).messages({
  'object.min': 'At least one field is required to update',
});

// ─── Change Password Schema ─────────────────────────────────────

/**
 * PUT /api/v1/users/password
 *
 * currentPassword has no strength check (it was validated at creation time).
 * newPassword has full strength requirements.
 */
export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'string.empty': 'Current password is required',
    'any.required': 'Current password is required',
  }),
  newPassword: passwordField.messages({
    ...passwordField._preferences?.messages,
    'any.required': 'New password is required',
  }),
});
