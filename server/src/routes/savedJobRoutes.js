import { Router } from 'express';
import * as savedJobController from '../controllers/savedJobController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';

/**
 * Saved Job Routes — /api/v1/saved-jobs
 *
 * Route Summary:
 *
 * | Method | Path       | Auth     | Role      | Middleware    |
 * |--------|------------|----------|-----------|--------------|
 * | POST   | /:jobId    | Bearer   | Candidate | auth, role   |
 * | GET    | /          | Bearer   | Candidate | auth, role   |
 * | DELETE | /:jobId    | Bearer   | Candidate | auth, role   |
 *
 * All endpoints are candidate-only. No validation middleware needed
 * since there are no request bodies.
 */

const router = Router();

// ─── Protected Routes (Candidate Only) ───────────────────────────

// Save a job to bookmarks
router.post(
  '/:jobId',
  authMiddleware,
  authorizeRoles('candidate'),
  savedJobController.saveJob
);

// Get candidate's saved jobs
router.get(
  '/',
  authMiddleware,
  authorizeRoles('candidate'),
  savedJobController.getSavedJobs
);

// Remove a job from saved list
router.delete(
  '/:jobId',
  authMiddleware,
  authorizeRoles('candidate'),
  savedJobController.removeSavedJob
);

export default router;
