import { Router } from 'express';
import * as applicationController from '../controllers/applicationController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import validate from '../middleware/validationMiddleware.js';
import { updateStatusSchema } from '../validators/applicationValidator.js';

/**
 * Application Routes — /api/v1/applications
 *
 * Route Summary:
 *
 * | Method | Path                    | Auth     | Role      | Middleware                |
 * |--------|-------------------------|----------|-----------|--------------------------|
 * | POST   | /apply/:jobId           | Bearer   | Candidate | auth, role               |
 * | GET    | /candidate/me           | Bearer   | Candidate | auth, role               |
 * | GET    | /job/:jobId             | Bearer   | Recruiter | auth, role               |
 * | PATCH  | /:id/status             | Bearer   | Recruiter | auth, role, validate     |
 *
 * ⚠️ CRITICAL ORDER: Fixed paths (/candidate/me, /job/:jobId) MUST be
 * defined BEFORE parameterized paths (/:id), otherwise Express will treat
 * "candidate" or "job" as an application ID parameter.
 */

const router = Router();

// ─── Protected Routes (Candidate Only) ───────────────────────────
// Must be defined BEFORE /:id to avoid route collisions

// Apply to a job
router.post(
  '/apply/:jobId',
  authMiddleware,
  authorizeRoles('candidate'),
  applicationController.applyForJob
);

// Candidate's own applications (dashboard)
// Defined before /:id so Express doesn't treat "candidate" as an application ID
router.get(
  '/candidate/me',
  authMiddleware,
  authorizeRoles('candidate'),
  applicationController.getCandidateApplications
);

// ─── Protected Routes (Recruiter Only) ───────────────────────────
// Must be defined BEFORE /:id to avoid route collisions

// Get applicants for a specific job
// Defined before /:id so Express doesn't treat "job" as an application ID
router.get(
  '/job/:jobId',
  authMiddleware,
  authorizeRoles('recruiter'),
  applicationController.getJobApplicants
);

// ─── Protected Routes (with param) ──────────────────────────────

// Update application status
router.patch(
  '/:id/status',
  authMiddleware,
  authorizeRoles('recruiter'),
  validate(updateStatusSchema),
  applicationController.updateApplicationStatus
);

export default router;
