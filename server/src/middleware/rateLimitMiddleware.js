import rateLimit from 'express-rate-limit';
import ApiResponse from '../utils/ApiResponse.js';

/**
 * Rate Limit Middleware — Auth-Specific Limiters
 *
 * Stricter rate limits for sensitive auth endpoints to prevent
 * brute-force attacks and abuse. These are layered ON TOP of the
 * global rate limiter in app.js (100 req/15min for all routes).
 *
 * Why per-route limiters instead of relying on the global one?
 * The global limiter allows 100 requests per 15 minutes — that's
 * 100 login attempts, which is enough for a credential stuffing attack.
 * Auth endpoints need much tighter limits.
 *
 * Why use the same ApiResponse format?
 * Consistency. The 429 response looks the same whether the global
 * limiter or a route-specific limiter triggers it.
 *
 * Interview Tip: "We layer rate limiters — a global baseline of 100 req/15min
 * for all routes, plus stricter per-route limits on auth endpoints.
 * Register gets 5 attempts, login gets 10, and forgot-password gets 3.
 * This prevents brute-force attacks without affecting normal usage."
 */

/**
 * Register: 5 attempts per 15 minutes per IP.
 * Why so low? Legitimate users register once. Anything more than
 * 5 attempts in 15 minutes is likely automated abuse.
 */
export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: new ApiResponse(429, null, 'Too many registration attempts. Please try again later.'),
});

/**
 * Login: 10 attempts per 15 minutes per IP.
 * Why 10? Users may mistype their password a few times, especially
 * if switching between multiple accounts. 10 is generous for
 * legitimate use but blocks brute-force attempts.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: new ApiResponse(429, null, 'Too many login attempts. Please try again later.'),
});

/**
 * Forgot Password: 3 attempts per 15 minutes per IP.
 * Why 3? Password reset generates an email — we don't want
 * attackers spamming someone's inbox. 3 is enough if the
 * email doesn't arrive, and limits email sending costs.
 */
export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: new ApiResponse(429, null, 'Too many password reset requests. Please try again later.'),
});
