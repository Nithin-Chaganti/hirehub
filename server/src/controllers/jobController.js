import * as jobService from '../services/jobService.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';

/**
 * Job Controller — HTTP Request/Response Handlers
 *
 * Thin layer that parses requests, delegates to jobService,
 * and formats responses. No business logic here.
 *
 * Notable patterns:
 * - getAllJobs returns a pagination object alongside the data
 * - getJobById populates the full company profile for the detail view
 * - deleteJob is a soft delete (sets isActive: false in the service)
 */

// ─── Create Job ─────────────────────────────────────────────────

/**
 * POST /api/v1/jobs
 *
 * Creates a new job posting. The company must belong to the
 * authenticated recruiter (verified in the service layer).
 */
export const createJob = asyncHandler(async (req, res) => {
  const job = await jobService.createJob(req.user._id, req.body);

  res
    .status(201)
    .json(new ApiResponse(201, job, 'Job created successfully'));
});

// ─── Get All Jobs (Public) ──────────────────────────────────────

/**
 * GET /api/v1/jobs
 *
 * Public endpoint — no auth required.
 * Supports search, filter, sort, and pagination via query params.
 *
 * Query params: search, location, jobType, experienceLevel,
 *               workMode, sortBy, sortOrder, page, limit
 */
export const getAllJobs = asyncHandler(async (req, res) => {
  const result = await jobService.getAllJobs(req.query);

  res
    .status(200)
    .json(new ApiResponse(200, result.jobs, 'Jobs fetched successfully', result.pagination));
});

// ─── Get Job by ID ──────────────────────────────────────────────

/**
 * GET /api/v1/jobs/:id
 *
 * Public endpoint — returns full job details with populated
 * company profile and recruiter name.
 */
export const getJobById = asyncHandler(async (req, res) => {
  const job = await jobService.getJobById(req.params.id);

  res
    .status(200)
    .json(new ApiResponse(200, job, 'Job fetched successfully'));
});

// ─── Update Job ─────────────────────────────────────────────────

/**
 * PUT /api/v1/jobs/:id
 *
 * Updates a job posting. Only the recruiter who created the
 * job can update it (ownership verified in service).
 */
export const updateJob = asyncHandler(async (req, res) => {
  const job = await jobService.updateJob(
    req.user._id,
    req.params.id,
    req.body
  );

  res
    .status(200)
    .json(new ApiResponse(200, job, 'Job updated successfully'));
});

// ─── Delete Job ─────────────────────────────────────────────────

/**
 * DELETE /api/v1/jobs/:id
 *
 * Soft-deletes a job by setting isActive to false.
 * The job data is preserved for application history.
 */
export const deleteJob = asyncHandler(async (req, res) => {
  await jobService.deleteJob(req.user._id, req.params.id);

  res
    .status(200)
    .json(new ApiResponse(200, null, 'Job deleted successfully'));
});

// ─── Get Recruiter's Jobs ───────────────────────────────────────

/**
 * GET /api/v1/jobs/recruiter/me
 *
 * Returns all jobs posted by the authenticated recruiter.
 * Supports pagination and optional isActive filter.
 */
export const getRecruiterJobs = asyncHandler(async (req, res) => {
  const result = await jobService.getRecruiterJobs(req.user._id, req.query);

  res
    .status(200)
    .json(new ApiResponse(200, result.jobs, 'Your jobs fetched successfully', result.pagination));
});
