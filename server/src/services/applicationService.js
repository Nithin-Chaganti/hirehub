import Application from '../models/Application.js';
import Job from '../models/Job.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { createNotification } from './notificationService.js';

/**
 * Application Service — Business Logic Layer
 *
 * Handles all application-related business operations:
 * - Job application with resume validation and duplicate prevention
 * - Candidate's application history with pagination
 * - Recruiter's applicant listing for their jobs
 * - Application status updates with state machine enforcement
 *
 * Key Design Decisions:
 * - State machine for status transitions prevents invalid status changes
 * - Resume validation: candidates must have a resume before applying
 * - Job ownership check: only the job owner can view applicants and update status
 * - Fire-and-forget notifications: don't block operations for notification creation
 * - Increment job.applicationCount on successful application (denormalized counter)
 *
 * Critical Improvements:
 * - Duplicate application now returns a proper 409 instead of a raw 11000 error
 * - Recruiters can never apply to their own job (extra guard)
 * - Data fetching is minimised using `.select()` for performance
 * - Future transaction support noted as a TODO for production readiness
 */

// ─── Status Transition State Machine ────────────────────────────────

/**
 * Defines valid status transitions.
 * Keys are current status, values are arrays of allowed next statuses.
 */
const STATUS_TRANSITIONS = {
  pending: ['reviewing', 'rejected'],
  reviewing: ['shortlisted', 'rejected'],
  shortlisted: ['accepted', 'rejected'],
  accepted: [], // Terminal state
  rejected: [], // Terminal state
};

/**
 * Check if a status transition is valid.
 *
 * @param {string} currentStatus - Current application status
 * @param {string} newStatus - Desired new status
 * @returns {boolean} True if transition is valid
 */
const isValidTransition = (currentStatus, newStatus) => {
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
};

// ─── Apply for Job ───────────────────────────────────────────────

/**
 * Apply to a job.
 *
 * Flow:
 * 1. Verify user is a candidate
 * 2. Check user has a resume uploaded
 * 3. Verify job exists and is active
 * 4. Prevent recruiters from applying to their own job (edge case)
 * 5. Create application – duplicate check handled via catch block
 * 6. Increment job.applicationCount
 * 7. Fire-and-forget notification to recruiter
 *
 * Duplicate applications: A unique compound index on {candidate, job} is
 * the final guard. If two requests race, the second will throw a 11000
 * error. We convert that into a user‑friendly 409 instead of a 500.
 *
 * @param {string} userId - The authenticated user's ID
 * @param {string} jobId - The job's document ID
 * @returns {Promise<object>} Created application document
 */
export const applyForJob = async (userId, jobId) => {
  // ── 1. Fetch user with only the fields we need ────────────────
  const user = await User.findById(userId).select('role resume');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.role !== 'candidate') {
    throw new ApiError(403, 'Only candidates can apply to jobs');
  }

  // Check user has a resume (Cloudinary publicId would be even safer,
  // but url is sufficient for the initial check)
  if (!user.resume?.url) {
    throw new ApiError(400, 'Please upload a resume before applying');
  }

  // ── 2. Fetch job (only needed fields) ────────────────────────
  const job = await Job.findById(jobId).select('title postedBy isActive');
  if (!job) {
    throw new ApiError(404, 'Job not found');
  }

  if (!job.isActive) {
    throw new ApiError(410, 'This job is no longer accepting applications');
  }

  // ── 3. Prevent recruiters from applying to their own job ─────
  // This covers an edge case where a recruiter’s role might be changed
  // or an admin uses a mixed account.
  if (job.postedBy.equals(userId)) {
    throw new ApiError(400, 'You cannot apply to your own job');
  }

  // ── 4. Create application with duplicate‑handling ────────────
  let application;
  try {
    application = await Application.create({
      candidate: userId,
      job: jobId,
      status: 'pending',
    });
  } catch (error) {
    // Unique index {candidate, job} causes E11000 on duplicate
    if (error.code === 11000) {
      throw new ApiError(409, 'You have already applied for this job');
    }
    throw error; // Re-throw unexpected errors
  }

  // ── 5. Increment job application count ───────────────────────
  // TODO (future production): wrap both operations in a MongoDB transaction
  // so that application creation and counter increment are atomic.
  await Job.findByIdAndUpdate(jobId, { $inc: { applicationCount: 1 } });

  // ── 6. Fire-and-forget notification to recruiter ─────────────
  void createNotification(
    job.postedBy,
    'new_application',
    'New Application Received',
    `A candidate has applied to your job: ${job.title}`,
    jobId,
    application._id
  );

  return application;
};

// ─── Get Candidate's Applications ──────────────────────────────────

/**
 * Get the current candidate's applications.
 *
 * Populates job details with company info for display.
 * Supports pagination and optional status filter.
 *
 * @param {string} userId - The authenticated candidate's user ID
 * @param {object} queryParams - Express req.query object
 * @returns {Promise<{ applications: object[], pagination: object }>}
 */
export const getCandidateApplications = async (userId, queryParams) => {
  const { page = 1, limit = 10, status } = queryParams;

  // Build filter
  const filter = { candidate: userId };
  if (status) {
    filter.status = status;
  }

  // Pagination
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  // Execute query
  const [applications, total] = await Promise.all([
    Application.find(filter)
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate({
        path: 'job',
        select: 'title location jobType experienceLevel salary',
        populate: {
          path: 'company',
          select: 'name logoUrl',
        },
      })
      .lean(),
    Application.countDocuments(filter),
  ]);

  return {
    applications,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.max(1, Math.ceil(total / limitNum)),
    },
  };
};

// ─── Get Job Applicants ───────────────────────────────────────────

/**
 * Get all applicants for a specific job.
 *
 * Only the recruiter who owns the job can view applicants.
 * Populates candidate profile details – now only includes resume.url
 * to avoid exposing full Cloudinary metadata unnecessarily.
 * Supports pagination and optional status filter.
 *
 * @param {string} userId - The authenticated recruiter's user ID
 * @param {string} jobId - The job's document ID
 * @param {object} queryParams - Express req.query object
 * @returns {Promise<{ applications: object[], pagination: object }>}
 */
export const getJobApplicants = async (userId, jobId, queryParams) => {
  const { page = 1, limit = 10, status } = queryParams;

  // Verify job exists and user owns it – only need a few fields
  const job = await Job.findById(jobId).select('postedBy');
  if (!job) {
    throw new ApiError(404, 'Job not found');
  }

  if (job.postedBy.toString() !== userId.toString()) {
    throw new ApiError(403, 'You can only view applicants for your own jobs');
  }

  // Build filter
  const filter = { job: jobId };
  if (status) {
    filter.status = status;
  }

  // Pagination
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  // Execute query – candidate population now returns only resume.url
  const [applications, total] = await Promise.all([
    Application.find(filter)
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('candidate', 'name email skills resume.url profilePicture')
      .lean(),
    Application.countDocuments(filter),
  ]);

  return {
    applications,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.max(1, Math.ceil(total / limitNum)),
    },
  };
};

// ─── Update Application Status ─────────────────────────────────────

/**
 * Update an application's status.
 *
 * Enforces state machine transitions to prevent invalid status changes.
 * Only the recruiter who owns the job can update application status.
 * Fires notification to candidate on status change.
 *
 * @param {string} userId - The authenticated recruiter's user ID
 * @param {string} applicationId - The application's document ID
 * @param {string} newStatus - The desired new status
 * @returns {Promise<object>} Updated application document
 */
export const updateApplicationStatus = async (userId, applicationId, newStatus) => {
  // Fetch application with job populate – only need job's postedBy
  const application = await Application.findById(applicationId)
    .populate('job', 'postedBy _id');

  if (!application) {
    throw new ApiError(404, 'Application not found');
  }

  // Verify user owns the job
  if (application.job.postedBy.toString() !== userId.toString()) {
    throw new ApiError(403, 'You can only update applications for your own jobs');
  }

  // Validate status transition
  const currentStatus = application.status;
  if (!isValidTransition(currentStatus, newStatus)) {
    throw new ApiError(
      400,
      `Cannot change status from '${currentStatus}' to '${newStatus}'`
    );
  }

  // Update status
  application.status = newStatus;
  await application.save();

  // Fire-and-forget notification to candidate
  const statusMessages = {
    reviewing: 'Your application is being reviewed',
    shortlisted: 'Congratulations! You have been shortlisted',
    accepted: 'Congratulations! Your application has been accepted',
    rejected: 'Your application was not selected',
  };

  void createNotification(
    application.candidate,
    'application_status',
    'Application Status Updated',
    statusMessages[newStatus] || 'Your application status has been updated',
    application.job._id,
    application._id
  );

  return application;
};