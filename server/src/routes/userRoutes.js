import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import validate from '../middleware/validationMiddleware.js';
import {
  candidateProfileSchema,
  recruiterProfileSchema,
  changePasswordSchema,
} from '../validators/userValidator.js';
import { uploadResume } from '../middleware/uploadMiddleware.js';

/**
 * User Routes — /api/v1/users
 *
 * All routes require authentication. Role-specific routes use
 * authorizeRoles() for RBAC enforcement.
 *
 * Route Summary:
 *
 * | Method | Path                  | Role       | Middleware                              |
 * |--------|-----------------------|------------|---------------------------------------- |
 * | GET    | /candidate/:id        | Recruiter  | auth, role('recruiter')                 |
 * | PUT    | /candidate/profile    | Candidate  | auth, role('candidate'), validate       |
 * | PUT    | /recruiter/profile    | Recruiter  | auth, role('recruiter'), validate       |
 * | PUT    | /password             | Any        | auth, validate                          |
 * | POST   | /resume/upload        | Candidate  | auth, role('candidate'), multer         |
 */

const router = Router();

// All user routes require authentication
router.use(authMiddleware);

// ─── Candidate Routes ────────────────────────────────────────────

// View a candidate's profile (recruiter only)
router.get(
  '/candidate/:id',
  authorizeRoles('recruiter'),
  userController.getCandidateProfile
);

// Update own candidate profile
router.put(
  '/candidate/profile',
  authorizeRoles('candidate'),
  validate(candidateProfileSchema),
  userController.updateCandidateProfile
);

// ─── Recruiter Routes ────────────────────────────────────────────

// Update own recruiter profile
router.put(
  '/recruiter/profile',
  authorizeRoles('recruiter'),
  validate(recruiterProfileSchema),
  userController.updateRecruiterProfile
);

// ─── Shared Routes ───────────────────────────────────────────────

// Change password (any authenticated user)
router.put(
  '/password',
  validate(changePasswordSchema),
  userController.changePassword
);

// Upload resume (candidate only)
router.post(
  '/resume/upload',
  authorizeRoles('candidate'),
  uploadResume,
  userController.uploadResumeHandler
);

export default router;
