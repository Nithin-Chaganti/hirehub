import { Router } from 'express';
import mongoose from 'mongoose';
import * as aiController from '../controllers/aiController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import ApiError from '../utils/ApiError.js';

/**
 * AI Routes — /api/v1/ai
 *
 * Route Summary:
 *
 * | Method | Path                           | Auth     | Role      | Middleware              |
 * |--------|--------------------------------|----------|-----------|------------------------|
 * | POST   | /analyze-resume                | Bearer   | Candidate | auth, role             |
 * | GET    | /jobs/recommendations          | Bearer   | Candidate | auth, role, validateLimit |
 * | GET    | /jobs/:jobId/match-score       | Bearer   | Candidate | auth, role, validateObjectId |
 *
 * All endpoints are candidate-only.
 * Now includes ObjectId validation for jobId and limit query validation.
 */

const router = Router();

/**
 * Middleware: Validate that req.params.id is a valid MongoDB ObjectId.
 */
const validateObjectId = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.jobId)) {
    return next(new ApiError(400, 'Invalid job ID format'));
  }
  next();
};

/**
 * Middleware: Validate 'limit' query parameter (integer, 1-20).
 */
const validateLimit = (req, res, next) => {
  const { limit } = req.query;
  if (limit !== undefined) {
    const parsed = parseInt(limit, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 20) {
      return next(new ApiError(400, 'Limit must be between 1 and 20'));
    }
    req.query.limit = parsed;
  }
  next();
};

// ─── Protected Routes (Candidate Only) ───────────────────────────

// Analyze resume using AI
router.post(
  '/analyze-resume',
  authMiddleware,
  authorizeRoles('candidate'),
  aiController.analyzeResume
);

// Get AI-powered job recommendations
router.get(
  '/jobs/recommendations',
  authMiddleware,
  authorizeRoles('candidate'),
  validateLimit,                    // NEW
  aiController.getJobRecommendations
);

// Get AI-powered match score for a specific job
router.get(
  '/jobs/:jobId/match-score',
  authMiddleware,
  authorizeRoles('candidate'),
  validateObjectId,                 // NEW
  aiController.getJobMatchScore
);

export default router;