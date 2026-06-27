import { Router } from 'express';
import * as jobController from '../controllers/jobController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import validate from '../middleware/validationMiddleware.js';
import {
  createJobSchema,
  updateJobSchema,
} from '../validators/jobValidator.js';

/**
 * Job Routes — /api/v1/jobs
 *
 * Route Summary:
 *
 * | Method | Path           | Auth     | Role      | Middleware                |
 * |--------|----------------|----------|-----------|--------------------------|
 * | POST   | /              | Bearer   | Recruiter | auth, role, validate     |
 * | GET    | /recruiter/me  | Bearer   | Recruiter | auth, role               |
 * | GET    | /              | None     | —         | (public)                 |
 * | GET    | /:id           | None     | —         | (public)                 |
 * | PUT    | /:id           | Bearer   | Recruiter | auth, role, validate     |
 * | DELETE | /:id           | Bearer   | Recruiter | auth, role               |
 *
 * ⚠️ CRITICAL ORDER: /recruiter/me MUST be defined BEFORE /:id,
 * otherwise Express will treat "recruiter" as a job ID parameter.
 * This is the same pattern used in company routes with /me vs /:id.
 */

const router = Router();

// ─── Protected Routes (Recruiter Only) ───────────────────────────
// Must be defined BEFORE /:id to avoid route collisions

// Create a job posting
router.post(
  '/',
  authMiddleware,
  authorizeRoles('recruiter'),
  validate(createJobSchema),
  jobController.createJob
);

// Recruiter's own jobs (dashboard)
// Defined before /:id so Express doesn't treat "recruiter" as a job ID
router.get(
  '/recruiter/me',
  authMiddleware,
  authorizeRoles('recruiter'),
  jobController.getRecruiterJobs
);

// ─── Public Routes ───────────────────────────────────────────────

// Browse all jobs (search, filter, sort, pagination)
router.get('/', jobController.getAllJobs);

// Get single job details
router.get('/:id', jobController.getJobById);

// ─── Protected Routes (with param) ──────────────────────────────

// Update a job posting
router.put(
  '/:id',
  authMiddleware,
  authorizeRoles('recruiter'),
  validate(updateJobSchema),
  jobController.updateJob
);

// Soft-delete a job posting
router.delete(
  '/:id',
  authMiddleware,
  authorizeRoles('recruiter'),
  jobController.deleteJob
);

export default router;
