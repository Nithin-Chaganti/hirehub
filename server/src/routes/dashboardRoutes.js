import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';

/**
 * Dashboard Routes — /api/v1/dashboard
 *
 * Route Summary:
 *
 * | Method | Path       | Auth   | Role      |
 * |--------|------------|--------|-----------|
 * | GET    | /recruiter | Bearer | Recruiter |
 * | GET    | /candidate | Bearer | Candidate |
 */

const router = Router();

router.get(
  '/recruiter',
  authMiddleware,
  authorizeRoles('recruiter'),
  dashboardController.getRecruiterDashboard
);

router.get(
  '/candidate',
  authMiddleware,
  authorizeRoles('candidate'),
  dashboardController.getCandidateDashboard
);

export default router;
