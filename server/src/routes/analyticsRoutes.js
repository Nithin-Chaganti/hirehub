import { Router } from 'express';
import mongoose from 'mongoose';
import * as analyticsController from '../controllers/analyticsController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import ApiError from '../utils/ApiError.js';

/**
 * Analytics Routes — /api/v1/analytics
 *
 * Route Summary:
 *
 * | Method | Path                           | Auth     | Role      | Middleware              |
 * |--------|--------------------------------|----------|-----------|------------------------|
 * | GET    | /recruiter                     | Bearer   | Recruiter | auth, role, validatePeriod |
 * | GET    | /candidate                     | Bearer   | Candidate | auth, role             |
 * | GET    | /job/:jobId                    | Bearer   | Recruiter | auth, role, validateObjectId |
 *
 * Defense in depth: period validation exists both in the route middleware
 * and in the service layer. If future callers bypass the route, the
 * service still enforces valid values.
 */

const router = Router();

const VALID_PERIODS = ['7d', '30d', '90d', 'all'];

const validatePeriod = (req, res, next) => {
  const { period } = req.query;
  if (period && !VALID_PERIODS.includes(period)) {
    return next(new ApiError(400, `Invalid period. Must be one of: ${VALID_PERIODS.join(', ')}`));
  }
  next();
};

const validateObjectId = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.jobId)) {
    return next(new ApiError(400, 'Invalid job ID format'));
  }
  next();
};

// ─── Recruiter Analytics ───────────────────────────────────────

router.get(
  '/recruiter',
  authMiddleware,
  authorizeRoles('recruiter'),
  validatePeriod,   // kept for defense in depth
  analyticsController.getRecruiterAnalytics
);

// ─── Candidate Analytics ───────────────────────────────────────

router.get(
  '/candidate',
  authMiddleware,
  authorizeRoles('candidate'),
  analyticsController.getCandidateAnalytics
);

// ─── Job Analytics ─────────────────────────────────────────────

router.get(
  '/job/:jobId',
  authMiddleware,
  authorizeRoles('recruiter'),
  validateObjectId,
  analyticsController.getJobAnalytics
);

export default router;