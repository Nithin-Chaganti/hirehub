import * as talentService from '../services/talentService.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';

/**
 * Talent Controller — HTTP Request/Response Handlers
 *
 * Thin layer for recruiter talent search endpoints.
 */

/**
 * GET /api/v1/talent/search
 */
export const searchTalent = asyncHandler(async (req, res) => {
  const { candidates, pagination } = await talentService.searchTalent(
    req.user._id,
    req.query
  );

  res
    .status(200)
    .json(new ApiResponse(200, candidates, 'Candidates found', pagination));
});

/**
 * GET /api/v1/talent/:candidateId
 */
export const getCandidateDetail = asyncHandler(async (req, res) => {
  const candidate = await talentService.getCandidateDetail(
    req.user._id,
    req.params.candidateId
  );

  res
    .status(200)
    .json(new ApiResponse(200, candidate, 'Candidate profile fetched successfully'));
});
