import Joi from 'joi';

/**
 * Application Validators — Joi Schemas
 *
 * Defines validation rules for application endpoints.
 * These schemas mirror the Mongoose Application model constraints and are
 * consumed by the generic validationMiddleware.
 */

// ─── Enum Constants ─────────────────────────────────────────────

const APPLICATION_STATUSES = [
  'pending',
  'reviewing',
  'shortlisted',
  'accepted',
  'rejected',
];

// ─── Update Status Schema ─────────────────────────────────────────

/**
 * PATCH /api/v1/applications/:id/status
 *
 * Validates the status field for application status updates.
 * The service layer enforces valid state transitions.
 */
export const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...APPLICATION_STATUSES)
    .required()
    .messages({
      'string.empty': 'Status is required',
      'any.required': 'Status is required',
      'any.only': `Status must be one of: ${APPLICATION_STATUSES.join(', ')}`,
    }),
});
