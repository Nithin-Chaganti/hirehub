import config from '../config/env.js';

/**
 * Cookie Security Helper
 *
 * Returns a standardized cookie options object for setting HTTP cookies
 * (primarily the refresh token). Centralizing this prevents cookie
 * misconfiguration from being scattered across auth controllers.
 *
 * Options explained:
 * - httpOnly: true  — prevents client-side JS from reading the cookie (XSS defense)
 * - secure: true    — cookie only sent over HTTPS (always on in production)
 * - sameSite:
 *     • 'strict' in development  — same-origin only (localhost → localhost)
 *     • 'none'   in production   — allows cross-origin cookies (Vercel ↔ Render)
 * - maxAge: 7 days  — aligns with the refresh token expiry so the cookie
 *                      and the token expire at the same time
 *
 * Usage:
 *   import { getCookieOptions } from '../utils/cookieOptions.js';
 *   res.cookie('refreshToken', token, getCookieOptions());
 *
 * Interview Tip: "We centralize cookie options in a utility so every
 * res.cookie() call uses the same secure defaults. This eliminates the
 * risk of one controller forgetting httpOnly or secure flags."
 */

// 7 days in milliseconds — matches refresh token expiry
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Get secure cookie options based on the current environment.
 *
 * @param {number} [maxAge=SEVEN_DAYS_MS] — cookie lifetime in milliseconds
 * @returns {object} cookie options for res.cookie()
 */
export const getCookieOptions = (maxAge = SEVEN_DAYS_MS) => {
  const isProduction = config.NODE_ENV === 'production';

  return {
    httpOnly: true,                           // Not accessible via document.cookie (XSS protection)
    secure: isProduction,                     // HTTPS only in production
    sameSite: isProduction ? 'none' : 'strict', // Cross-origin in prod, same-origin in dev
    maxAge,                                   // Cookie lifetime in milliseconds
  };
};

/**
 * Get options for clearing a cookie (logout).
 * Sets maxAge to 0 so the browser deletes it immediately.
 *
 * Usage:
 *   import { getClearCookieOptions } from '../utils/cookieOptions.js';
 *   res.clearCookie('refreshToken', getClearCookieOptions());
 */
export const getClearCookieOptions = () => {
  return getCookieOptions(0);
};
