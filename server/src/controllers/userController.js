import * as userService from '../services/userService.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import { getClearCookieOptions } from '../utils/cookieOptions.js';

/**
 * User Controller — HTTP Request/Response Handlers
 *
 * Thin layer that parses requests, delegates to userService,
 * and formats responses. No business logic here.
 *
 * Notable behavior:
 * - changePassword clears the refresh cookie (forces re-login)
 * - uploadResume expects req.file from Multer middleware
 */

const REFRESH_TOKEN_COOKIE = 'refreshToken';

// ─── Get Candidate Profile ───────────────────────────────────────

/**
 * GET /api/v1/users/candidate/:id
 *
 * Returns a candidate's public profile. Only accessible by recruiters
 * (enforced by roleMiddleware in the route definition).
 */
export const getCandidateProfile = asyncHandler(async (req, res) => {
  const candidate = await userService.getCandidateProfile(req.params.id);

  res
    .status(200)
    .json(new ApiResponse(200, candidate, 'Candidate profile fetched successfully'));
});

// ─── Update Candidate Profile ────────────────────────────────────

/**
 * PUT /api/v1/users/candidate/profile
 *
 * Updates the authenticated candidate's own profile.
 * Role check is in the route (authorizeRoles('candidate')).
 */
export const updateCandidateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateCandidateProfile(req.user._id, req.body);

  res
    .status(200)
    .json(new ApiResponse(200, user, 'Profile updated successfully'));
});

// ─── Update Recruiter Profile ────────────────────────────────────

/**
 * PUT /api/v1/users/recruiter/profile
 *
 * Updates the authenticated recruiter's own profile.
 */
export const updateRecruiterProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateRecruiterProfile(req.user._id, req.body);

  res
    .status(200)
    .json(new ApiResponse(200, user, 'Profile updated successfully'));
});

// ─── Change Password ─────────────────────────────────────────────

/**
 * PUT /api/v1/users/password
 *
 * Changes the user's password and clears the refresh token cookie.
 * The client should redirect to the login page after this response.
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  await userService.changePassword(req.user._id, currentPassword, newPassword);

  res
    .status(200)
    .clearCookie(REFRESH_TOKEN_COOKIE, getClearCookieOptions())
    .json(new ApiResponse(200, null, 'Password changed successfully'));
});

// ─── Upload Resume ───────────────────────────────────────────────

/**
 * POST /api/v1/users/resume/upload
 *
 * Uploads or replaces the candidate's resume (PDF).
 * The file is available as req.file.buffer from Multer's memory storage.
 */
export const uploadResumeHandler = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new (await import('../utils/ApiError.js')).default(400, 'Please upload a resume file');
  }

  const result = await userService.uploadResume(req.user._id, req.file.buffer);

  res
    .status(200)
    .json(new ApiResponse(200, result, 'Resume uploaded successfully'));
});
