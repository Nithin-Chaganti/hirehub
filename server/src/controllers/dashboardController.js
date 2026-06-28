import * as dashboardService from '../services/dashboardService.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';

/**
 * Dashboard Controller — HTTP Request/Response Handlers
 *
 * Thin layer for recruiter and candidate dashboard endpoints.
 */

/**
 * GET /api/v1/dashboard/recruiter
 */
export const getRecruiterDashboard = asyncHandler(async (req, res) => {
  const dashboard = await dashboardService.getRecruiterDashboard(req.user._id);

  res
    .status(200)
    .json(new ApiResponse(200, dashboard, 'Dashboard data fetched successfully'));
});

/**
 * GET /api/v1/dashboard/candidate
 */
export const getCandidateDashboard = asyncHandler(async (req, res) => {
  const dashboard = await dashboardService.getCandidateDashboard(req.user._id);

  res
    .status(200)
    .json(new ApiResponse(200, dashboard, 'Dashboard data fetched successfully'));
});
