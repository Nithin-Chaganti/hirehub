import Joi from 'joi';
import { JOB_TYPES, EXPERIENCE_LEVELS, WORK_MODES, CURRENCIES } from '../constants/jobConstants.js';

/**
 * Job Validators — Joi Schemas
 *
 * Defines validation rules for job posting endpoints.
 * These schemas mirror the Mongoose Job model constraints and are
 * consumed by the generic validationMiddleware.
 *
 * Design Notes:
 * - Salary sub-schema uses .custom() for max >= min cross-field validation
 * - Requirements array enforces min 1 item at the Joi level
 * - workMode is included even though the original API contract didn't list it,
 *   because the Job model requires it — omitting it would cause Mongoose errors
 * - company field is validated as a 24-char hex string (ObjectId pattern)
 *   but NOT verified as an actual ObjectId — the service layer checks ownership
 */

// ─── Enum Constants ─────────────────────────────────────────────

// ─── Shared Field Definitions ────────────────────────────────────

const titleField = Joi.string()
  .trim()
  .min(5)
  .max(100)
  .messages({
    'string.min': 'Job title must be at least 5 characters',
    'string.max': 'Job title cannot exceed 100 characters',
  });

const descriptionField = Joi.string()
  .trim()
  .min(20)
  .max(5000)
  .messages({
    'string.min': 'Job description must be at least 20 characters',
    'string.max': 'Job description cannot exceed 5000 characters',
  });

const requirementsField = Joi.array()
  .items(
    Joi.string().trim().min(1).max(100).messages({
      'string.min': 'Requirement cannot be empty',
      'string.max': 'Each requirement cannot exceed 100 characters',
    })
  )
  .unique()
  .min(1)
  .max(20)
  .messages({
    'array.unique': 'Requirements must not contain duplicates',
    'array.min': 'At least one requirement is required',
    'array.max': 'Cannot have more than 20 requirements',
  });

const salaryField = Joi.object({
  min: Joi.number()
    .min(0)
    .messages({
      'number.min': 'Minimum salary cannot be negative',
    }),
  max: Joi.number()
    .min(0)
    .messages({
      'number.min': 'Maximum salary cannot be negative',
    }),
  currency: Joi.string()
    .trim()
    .uppercase()
    .valid(...CURRENCIES)
    .default('INR'),
}).custom((value, helpers) => {
  if (value.max != null && value.min == null) {
    return helpers.error('any.invalid', {
      message: 'Minimum salary is required when maximum salary is provided',
    });
  }

  // Cross-field validation: max must be >= min
  if (value.min != null && value.max != null && value.max < value.min) {
    return helpers.error('any.invalid', {
      message: 'Maximum salary must be greater than or equal to minimum salary',
    });
  }
  return value;
}).messages({
  'any.invalid': 'Maximum salary must be greater than or equal to minimum salary',
});

const locationField = Joi.string()
  .trim()
  .min(2)
  .max(100)
  .messages({
    'string.min': 'Location must be at least 2 characters',
    'string.max': 'Location cannot exceed 100 characters',
  });

const jobTypeField = Joi.string()
  .valid(...JOB_TYPES)
  .messages({
    'any.only': `Job type must be one of: ${JOB_TYPES.join(', ')}`,
  });

const experienceLevelField = Joi.string()
  .valid(...EXPERIENCE_LEVELS)
  .messages({
    'any.only': `Experience level must be one of: ${EXPERIENCE_LEVELS.join(', ')}`,
  });

const workModeField = Joi.string()
  .valid(...WORK_MODES)
  .messages({
    'any.only': `Work mode must be one of: ${WORK_MODES.join(', ')}`,
  });

// ObjectId pattern: 24 hex characters
const objectIdField = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({
    'string.pattern.base': 'Invalid company ID format',
  });

// ─── Create Job Schema ──────────────────────────────────────────

/**
 * POST /api/v1/jobs
 *
 * All core fields required. Salary is optional.
 * Company must be a valid ObjectId string — ownership is verified in the service.
 */
export const createJobSchema = Joi.object({
  title: titleField.required().messages({
    'string.empty': 'Job title is required',
    'any.required': 'Job title is required',
  }),
  description: descriptionField.required().messages({
    'string.empty': 'Job description is required',
    'any.required': 'Job description is required',
  }),
  requirements: requirementsField.required().messages({
    'any.required': 'Requirements are required',
  }),
  salary: salaryField,
  location: locationField.required().messages({
    'string.empty': 'Location is required',
    'any.required': 'Location is required',
  }),
  jobType: jobTypeField.required().messages({
    'any.required': 'Job type is required',
  }),
  experienceLevel: experienceLevelField.required().messages({
    'any.required': 'Experience level is required',
  }),
  workMode: workModeField.required().messages({
    'any.required': 'Work mode is required',
  }),
  company: objectIdField.required().messages({
    'string.empty': 'Company is required',
    'any.required': 'Company is required',
  }),
});

// ─── Update Job Schema ──────────────────────────────────────────

/**
 * PUT /api/v1/jobs/:id
 *
 * All fields optional, but at least one must be provided.
 * Company cannot be changed after creation — excluded from update schema.
 */
export const updateJobSchema = Joi.object({
  title: titleField,
  description: descriptionField,
  requirements: requirementsField,
  salary: salaryField,
  location: locationField,
  jobType: jobTypeField,
  experienceLevel: experienceLevelField,
  workMode: workModeField,
}).min(1).messages({
  'object.min': 'At least one field is required to update',
});
