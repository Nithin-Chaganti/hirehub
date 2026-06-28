import { Router } from 'express';
import mongoose from 'mongoose';
import * as talentController from '../controllers/talentController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import ApiError from '../utils/ApiError.js';
import { EXPERIENCE_LEVELS } from '../constants/jobConstants.js';

/**
 * Talent Routes — /api/v1/talent
 *
 * Route Summary:
 *
 * | Method | Path           | Auth   | Role      | Middleware                    |
 * |--------|----------------|--------|-----------|-------------------------------|
 * | GET    | /search        | Bearer | Recruiter | auth, role, validateSearch    |
 * | GET    | /:candidateId  | Bearer | Recruiter | auth, role, validateObjectId  |
 *
 * ⚠️ CRITICAL ORDER: /search must be registered before /:candidateId
 */

const router = Router();
const VALID_SORT_OPTIONS = ['relevance', 'createdAt'];

const validateSearchQuery = (req, res, next) => {
  const { skills, location, experienceLevel, sortBy } = req.query;

  const hasSkills = Boolean(skills && String(skills).trim());
  const hasLocation = Boolean(location && String(location).trim());
  const hasExperienceLevel = Boolean(experienceLevel);

  if (!hasSkills && !hasLocation && !hasExperienceLevel) {
    return next(
      new ApiError(
        400,
        'Please provide at least one search criteria (skills, location, or experience)'
      )
    );
  }

  if (experienceLevel && !EXPERIENCE_LEVELS.includes(experienceLevel)) {
    return next(
      new ApiError(400, `Invalid experience level. Must be one of: ${EXPERIENCE_LEVELS.join(', ')}`)
    );
  }

  if (sortBy && !VALID_SORT_OPTIONS.includes(sortBy)) {
    return next(
      new ApiError(400, `Invalid sortBy. Must be one of: ${VALID_SORT_OPTIONS.join(', ')}`)
    );
  }

  next();
};

const validateObjectId = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.candidateId)) {
    return next(new ApiError(400, 'Invalid candidate ID format'));
  }
  next();
};

router.get(
  '/search',
  authMiddleware,
  authorizeRoles('recruiter'),
  validateSearchQuery,
  talentController.searchTalent
);

router.get(
  '/:candidateId',
  authMiddleware,
  authorizeRoles('recruiter'),
  validateObjectId,
  talentController.getCandidateDetail
);

export default router;
