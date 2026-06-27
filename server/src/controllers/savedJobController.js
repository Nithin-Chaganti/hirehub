import * as savedJobService from '../services/savedJobService.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';

/**
 * Saved Job Controller — HTTP Request/Response Handlers
 *
 * Thin layer that parses requests, delegates to savedJobService,
 * and formats responses. No business logic here.
 *
 * Notable patterns:
 * - getSavedJobs returns a pagination object alongside the data
 * - saveJob returns 201, others return 200
 * - No request body validation needed (no request bodies)
 */

// ─── Save Job ───────────────────────────────────────────────────

/**
 * POST /api/v1/saved-jobs/:jobId
 *
 * Saves the authenticated candidate's job to bookmarks.
 */
export const saveJob = asyncHandler(async (req, res) => {
  const savedJob = await savedJobService.saveJob(req.user._id, req.params.jobId);

  res
    .status(201)
    .json(new ApiResponse(201, savedJob, 'Job saved successfully'));
});

// ─── Get Saved Jobs ──────────────────────────────────────────────

/**
 * GET /api/v1/saved-jobs
 *
 * Returns the authenticated candidate's saved jobs.
 * Supports pagination.
 */
export const getSavedJobs = asyncHandler(async (req, res) => {
  const result = await savedJobService.getSavedJobs(req.user._id, req.query);

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        result.savedJobs,
        'Saved jobs fetched successfully',
        result.pagination
      )
    );
});

// ─── Remove Saved Job ───────────────────────────────────────────

/**
 * DELETE /api/v1/saved-jobs/:jobId
 *
 * Removes a job from the candidate's saved list.
 */
export const removeSavedJob = asyncHandler(async (req, res) => {
  await savedJobService.removeSavedJob(req.user._id, req.params.jobId);

  res
    .status(200)
    .json(new ApiResponse(200, null, 'Job removed from saved list'));
});
