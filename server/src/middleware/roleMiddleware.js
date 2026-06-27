import ApiError from '../utils/ApiError.js';

/**
 * Role Middleware — Role-Based Access Control (RBAC)
 *
 * A middleware factory that restricts route access based on user roles.
 * Must be placed AFTER authMiddleware in the middleware chain, since it
 * reads `req.user.role` which authMiddleware sets.
 *
 * Usage:
 *   import { authorizeRoles } from '../middleware/roleMiddleware.js';
 *
 *   // Single role
 *   router.post('/jobs', authMiddleware, authorizeRoles('recruiter'), jobController.create);
 *
 *   // Multiple roles
 *   router.get('/analytics', authMiddleware, authorizeRoles('recruiter', 'admin'), analyticsController.get);
 *
 * Why a factory (higher-order function)?
 * Different routes allow different roles. The factory accepts roles as
 * arguments and returns a middleware pre-configured for those roles.
 * Clean, readable, and reusable.
 *
 * Why use rest parameters (...allowedRoles)?
 * Some routes may allow multiple roles (e.g., both recruiter and admin).
 * Rest params handle single and multi-role cases with one function.
 *
 * Interview Tip: "We use a middleware factory for RBAC. The factory
 * takes allowed roles as arguments and returns a middleware that checks
 * req.user.role. This is cleaner than switch statements in controllers
 * and keeps authorization logic out of business logic."
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    // req.user is guaranteed to exist because authMiddleware runs first
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      throw new ApiError(403, 'You do not have permission to perform this action');
    }

    next();
  };
};
