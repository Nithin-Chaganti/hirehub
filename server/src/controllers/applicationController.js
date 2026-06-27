import * as applicationService from '../services/applicationService.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';

/**
 * Application Controller — HTTP Request/Response Handlers
 *
 * Thin layer that parses requests, delegates to applicationService,
 * and formats responses. No business logic here.
 *
 * Notable patterns:
 * - getCandidateApplications and getJobApplicants return pagination objects
 * - applyForJob requires no request body (candidate info from JWT)
 * - updateApplicationStatus enforces state machine transitions in service
 */

// ─── Apply for Job ───────────────────────────────────────────────

/**
 * POST /api/v1/applications/apply/:jobId
 *
 * Applies the authenticated candidate to a job.
 * Requires the candidate to have a resume uploaded.
 */
export const applyForJob = asyncHandler(async (req, res) => {
  const application = await applicationService.applyForJob(
    req.user._id,
    req.params.jobId
  );

  res
    .status(201)
    .json(new ApiResponse(201, application, 'Application submitted successfully'));
});

// ─── Get Candidate's Applications ──────────────────────────────────

/**
 * GET /api/v1/applications/candidate/me
 *
 * Returns the authenticated candidate's application history.
 * Supports pagination and optional status filter.
 */
export const getCandidateApplications = asyncHandler(async (req, res) => {
  const result = await applicationService.getCandidateApplications(
    req.user._id,
    req.query
  );

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        result.applications,
        'Applications fetched successfully',
        result.pagination
      )
    );
});

// ─── Get Job Applicants ───────────────────────────────────────────

/**
 * GET /api/v1/applications/job/:jobId
 *
 * Returns all applicants for a specific job.
 * Only the recruiter who owns the job can access this endpoint.
 * Supports pagination and optional status filter.
 */
export const getJobApplicants = asyncHandler(async (req, res) => {
  const result = await applicationService.getJobApplicants(
    req.user._id,
    req.params.jobId,
    req.query
  );

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        result.applications,
        'Applicants fetched successfully',
        result.pagination
      )
    );
});

// ─── Update Application Status ─────────────────────────────────────

/**
 * PATCH /api/v1/applications/:id/status
 *
 * Updates an application's status.
 * Only the recruiter who owns the job can update status.
 * State machine enforces valid transitions.
 */
export const updateApplicationStatus = asyncHandler(async (req, res) => {
  const application = await applicationService.updateApplicationStatus(
    req.user._id,
    req.params.id,
    req.body.status
  );

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        application,
        `Application status updated to ${application.status}`
      )
    );
});
