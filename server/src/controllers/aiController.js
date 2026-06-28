import * as aiService from '../services/aiService.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';

/**
 * AI Controller — HTTP Request/Response Handlers
 *
 * Thin layer that parses requests, delegates to aiService,
 * and formats responses. No business logic here.
 *
 * Notable patterns:
 * - All endpoints return 200
 * - No request body validation needed (no request bodies)
 * - Candidate-only endpoints (role middleware)
 */

// ─── Analyze Resume ─────────────────────────────────────────────

/**
 * POST /api/v1/ai/analyze-resume
 *
 * Analyzes the candidate's uploaded resume using AI.
 */
export const analyzeResume = asyncHandler(async (req, res) => {
  const analysis = await aiService.analyzeResume(req.user._id);

  res
    .status(200)
    .json(new ApiResponse(200, analysis, 'Resume analyzed successfully'));
});

// ─── Get Job Recommendations ────────────────────────────────────────

/**
 * GET /api/v1/ai/jobs/recommendations
 *
 * Returns AI-powered job recommendations based on candidate's profile.
 */
export const getJobRecommendations = asyncHandler(async (req, res) => {
  const { limit } = req.query;
  const recommendations = await aiService.getJobRecommendations(req.user._id, limit);

  res
    .status(200)
    .json(new ApiResponse(200, recommendations, 'Recommendations generated successfully'));
});

// ─── Get Job Match Score ─────────────────────────────────────────

/**
 * GET /api/v1/ai/jobs/:jobId/match-score
 *
 * Returns an AI-powered match score between candidate and specific job.
 */
export const getJobMatchScore = asyncHandler(async (req, res) => {
  const matchAnalysis = await aiService.getJobMatchScore(req.user._id, req.params.jobId);

  res
    .status(200)
    .json(new ApiResponse(200, matchAnalysis, 'Match score calculated successfully'));
});
