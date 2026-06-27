import Joi from 'joi';

/**
 * Company Validators — Joi Schemas
 *
 * Defines validation rules for company profile endpoints.
 * The create schema requires a name; the update schema makes
 * everything optional but requires at least one field.
 */

// ─── Shared Field Definitions ────────────────────────────────────

const nameField = Joi.string()
  .trim()
  .min(2)
  .max(100)
  .messages({
    'string.min': 'Company name must be at least 2 characters',
    'string.max': 'Company name cannot exceed 100 characters',
  });

const descriptionField = Joi.string()
  .trim()
  .max(1000)
  .allow('')
  .messages({
    'string.max': 'Company description cannot exceed 1000 characters',
  });

const websiteField = Joi.string()
  .trim()
  .uri({ scheme: ['http', 'https'] })
  .allow('')
  .messages({
    'string.uri': 'Website must be a valid URL (http:// or https://)',
  });

const locationField = Joi.string()
  .trim()
  .max(100)
  .allow('')
  .messages({
    'string.max': 'Location cannot exceed 100 characters',
  });

// ─── Create Company Schema ──────────────────────────────────────

/**
 * POST /api/v1/companies
 *
 * Name is required; other fields are optional.
 */
export const createCompanySchema = Joi.object({
  name: nameField.required().messages({
    'string.empty': 'Company name is required',
    'any.required': 'Company name is required',
  }),
  description: descriptionField,
  website: websiteField,
  location: locationField,
});

// ─── Update Company Schema ──────────────────────────────────────

/**
 * PUT /api/v1/companies/:id
 *
 * All fields optional, but at least one must be provided.
 */
export const updateCompanySchema = Joi.object({
  name: nameField,
  description: descriptionField,
  website: websiteField,
  location: locationField,
}).min(1).messages({
  'object.min': 'At least one field is required to update',
});
