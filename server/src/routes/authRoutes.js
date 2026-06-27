import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import validate from '../middleware/validationMiddleware.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/authValidator.js';
import {
  registerLimiter,
  loginLimiter,
  forgotPasswordLimiter,
} from '../middleware/rateLimitMiddleware.js';

/**
 * Auth Routes — /api/v1/auth
 *
 * Defines the route → middleware → controller mapping for all
 * authentication endpoints. Middleware order matters:
 *
 *   Rate Limiter → Validation → Controller  (public routes)
 *   Auth Middleware → Controller              (protected routes)
 *
 * Route Summary:
 *
 * | Method | Path                   | Auth    | Middleware                           |
 * |--------|------------------------|---------|--------------------------------------|
 * | POST   | /register              | None    | registerLimiter, validate(register)  |
 * | POST   | /login                 | None    | loginLimiter, validate(login)        |
 * | POST   | /logout                | Bearer  | authMiddleware                       |
 * | POST   | /refresh-token         | Cookie  | (none — reads cookie directly)       |
 * | GET    | /me                    | Bearer  | authMiddleware                       |
 * | POST   | /forgot-password       | None    | forgotPasswordLimiter, validate      |
 * | POST   | /reset-password/:token | None    | validate(resetPassword)              |
 */

const router = Router();

// ─── Public Routes (No Auth Required) ────────────────────────────

router.post(
  '/register',
  registerLimiter,
  validate(registerSchema),
  authController.register
);

router.post(
  '/login',
  loginLimiter,
  validate(loginSchema),
  authController.login
);

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

router.post(
  '/reset-password/:token',
  validate(resetPasswordSchema),
  authController.resetPassword
);

// ─── Cookie-Based Route (Refresh Token) ──────────────────────────

// No authMiddleware — the refresh token comes from the cookie, not
// the Authorization header. The access token may be expired here.
router.post('/refresh-token', authController.refreshToken);

// ─── Protected Routes (Bearer Token Required) ────────────────────

router.post('/logout', authMiddleware, authController.logout);
router.get('/me', authMiddleware, authController.getMe);

export default router;
