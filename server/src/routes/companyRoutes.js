import { Router } from 'express';
import * as companyController from '../controllers/companyController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import validate from '../middleware/validationMiddleware.js';
import {
  createCompanySchema,
  updateCompanySchema,
} from '../validators/companyValidator.js';
import { uploadLogo } from '../middleware/uploadMiddleware.js';

/**
 * Company Routes — /api/v1/companies
 *
 * Route Summary (updated):
 *
 * | Method | Path   | Auth     | Role      | Middleware                |
 * |--------|--------|----------|-----------|--------------------------|
 * | POST   | /      | Bearer   | Recruiter | auth, role, validate     |
 * | GET    | /me    | Bearer   | Recruiter | auth, role               |  // NEW
 * | PUT    | /logo  | Bearer   | Recruiter | auth, role, multer       |  // PUT /logo
 * | GET    | /:id   | None     | —         | (public)                 |
 * | PUT    | /:id   | Bearer   | Recruiter | auth, role, validate     |
 * | DELETE | /:id   | Bearer   | Recruiter | auth, role               |  // NEW
 *
 * ⚠️ CRITICAL ORDER: Fixed paths (/me, /logo) MUST be defined
 * BEFORE /:id, otherwise Express will treat "me" or "logo" as a
 * company ID parameter.  Always place parameterized routes last.
 */

const router = Router();

// ─── Protected Routes (Recruiter Only) ───────────────────────────
// Must be defined BEFORE /:id to avoid route collisions

// Create a company
router.post(
  '/',
  authMiddleware,
  authorizeRoles('recruiter'),
  validate(createCompanySchema),
  companyController.createCompany
);

// NEW: Recruiter's own company (dashboard convenience)
router.get(
  '/me',
  authMiddleware,
  authorizeRoles('recruiter'),
  companyController.getMyCompany
);

// Logo upload (PUT semantics for replacement; defined before /:id)
router.put(
  '/logo',
  authMiddleware,
  authorizeRoles('recruiter'),
  uploadLogo,
  companyController.uploadCompanyLogo
);

// ─── Public Route (with param) ───────────────────────────────────
// /:id must come AFTER all fixed-path routes

router.get('/:id', companyController.getCompany);

// ─── More Protected Routes (with param) ──────────────────────────

// Update a company
router.put(
  '/:id',
  authMiddleware,
  authorizeRoles('recruiter'),
  validate(updateCompanySchema),
  companyController.updateCompany
);

// NEW: Delete a company (recruiter only)
router.delete(
  '/:id',
  authMiddleware,
  authorizeRoles('recruiter'),
  companyController.deleteCompany
);

export default router;