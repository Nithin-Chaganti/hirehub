import * as analyticsService from '../services/analyticsService.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';

/**
 * Analytics Controller — HTTP Request/Response Handlers
 *
 * Thin layer that parses requests, delegates to analyticsService,
 * and formats responses. No business logic here.
 *
 * Notable patterns:
 * - All endpoints return 200
 * - No request body validation needed (no request bodies)
 * - Role-based access (recruiter/candidate only)
 */

// ─── Recruiter Analytics ─────────────────────────────────────────

/**
 * GET /api/v1/analytics/recruiter
 *
 * Returns analytics data for the recruiter's hiring activity.
 */
export const getRecruiterAnalytics = asyncHandler(async (req, res) => {
  const { period } = req.query;
  const analytics = await analyticsService.getRecruiterAnalytics(req.user._id, period);

  res
    .status(200)
    .json(new ApiResponse(200, analytics, 'Recruiter analytics fetched successfully'));
});

// ─── Candidate Analytics ────────────────────────────────────────

/**
 * GET /api/v1/analytics/candidate
 *
 * Returns analytics data for the candidate's job search activity.
 */
export const getCandidateAnalytics = asyncHandler(async (req, res) => {
  const analytics = await analyticsService.getCandidateAnalytics(req.user._id);

  res
    .status(200)
    .json(new ApiResponse(200, analytics, 'Candidate analytics fetched successfully'));
});

// ─── Job Analytics ──────────────────────────────────────────────

/**
 * GET /api/v1/analytics/job/:jobId
 *
 * Returns analytics for a specific job posting.
 */
export const getJobAnalytics = asyncHandler(async (req, res) => {
  const analytics = await analyticsService.getJobAnalytics(req.user._id, req.params.jobId);

  res
    .status(200)
    .json(new ApiResponse(200, analytics, 'Job analytics fetched successfully'));
});
