import * as authService from '../services/authService.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import { getCookieOptions, getClearCookieOptions } from '../utils/cookieOptions.js';

/**
 * Auth Controller — HTTP Request/Response Handlers
 *
 * Thin layer that:
 * 1. Parses HTTP request (body, params, cookies)
 * 2. Delegates to authService for business logic
 * 3. Formats response with ApiResponse
 * 4. Sets/clears cookies for refresh tokens
 *
 * No business logic here. If you see an if-statement checking
 * business rules, it belongs in authService.
 *
 * All handlers are wrapped in asyncHandler to auto-forward errors
 * to the error middleware — no try/catch boilerplate needed.
 */

// ─── Cookie Name Constant ────────────────────────────────────────

const REFRESH_TOKEN_COOKIE = 'refreshToken';

// ─── Register ────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 *
 * Creates a new user account, generates tokens, and returns
 * the user data + access token. The refresh token is set as
 * an httpOnly cookie.
 */
export const register = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.register(req.body);

  res
    .status(201)
    .cookie(REFRESH_TOKEN_COOKIE, refreshToken, getCookieOptions())
    .json(new ApiResponse(201, { user, accessToken }, 'Registration successful'));
});

// ─── Login ───────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/login
 *
 * Authenticates the user and returns tokens.
 * Old refresh token is rotated (invalidated + replaced).
 */
export const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body);

  res
    .status(200)
    .cookie(REFRESH_TOKEN_COOKIE, refreshToken, getCookieOptions())
    .json(new ApiResponse(200, { user, accessToken }, 'Login successful'));
});

// ─── Logout ──────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/logout
 *
 * Invalidates the refresh token in the database and clears
 * the refresh token cookie. The access token remains valid
 * until it expires (up to 15 minutes) — this is a known
 * JWT limitation.
 */
export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id);

  res
    .status(200)
    .clearCookie(REFRESH_TOKEN_COOKIE, getClearCookieOptions())
    .json(new ApiResponse(200, null, 'Logged out successfully'));
});

// ─── Refresh Token ───────────────────────────────────────────────

/**
 * POST /api/v1/auth/refresh-token
 *
 * Uses the refresh token from the httpOnly cookie to issue
 * a new access token + rotated refresh token.
 *
 * The browser sends the cookie automatically — no Authorization
 * header needed. The Axios interceptor on the frontend calls
 * this endpoint when a 401 is received.
 */
export const refreshToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies[REFRESH_TOKEN_COOKIE];

  const { accessToken, refreshToken: newRefreshToken } =
    await authService.refreshAccessToken(incomingRefreshToken);

  res
    .status(200)
    .cookie(REFRESH_TOKEN_COOKIE, newRefreshToken, getCookieOptions())
    .json(new ApiResponse(200, { accessToken }, 'Token refreshed'));
});

// ─── Get Current User ────────────────────────────────────────────

/**
 * GET /api/v1/auth/me
 *
 * Returns the authenticated user's basic info. Used by the
 * frontend to hydrate auth state on app load (when the user
 * has a valid access token stored in memory).
 */
export const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user._id);

  res
    .status(200)
    .json(new ApiResponse(200, user, 'User fetched successfully'));
});

// ─── Forgot Password ────────────────────────────────────────────

/**
 * POST /api/v1/auth/forgot-password
 *
 * Generates a reset token and sends it via email.
 * Always returns 200 even if the email doesn't exist
 * (prevents email enumeration attacks).
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);

  // Always return success — don't reveal if email exists
  res
    .status(200)
    .json(new ApiResponse(200, null, 'Password reset link sent to your email'));
});

// ─── Reset Password ─────────────────────────────────────────────

/**
 * POST /api/v1/auth/reset-password/:token
 *
 * Resets the password using the token from the email link.
 * On success, all existing sessions are invalidated (refresh
 * token cleared), forcing re-login on all devices.
 */
export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.params.token, req.body.password);

  res
    .status(200)
    .json(new ApiResponse(200, null, 'Password reset successful. Please log in.'));
});
