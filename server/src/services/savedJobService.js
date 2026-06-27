import SavedJob from '../models/SavedJob.js';
import Job from '../models/Job.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';

/**
 * Saved Job Service — Business Logic Layer
 *
 * Handles all saved job operations:
 * - Saving a job to bookmarks
 * - Retrieving candidate's saved jobs with pagination
 * - Removing a job from saved list
 *
 * Key Design Decisions:
 * - Unique compound index on { candidate, job } prevents duplicate saves
 * - Query-level authorization: all queries filter by candidate ID
 * - Populate job with company details for display
 * - Sort by savedAt desc (newest saves first)
 *
 * Phase 9 Improvements:
 * - Duplicate save → proper 409 Conflict instead of raw E11000
 * - Inactive jobs rejected with 410 to keep bookmarks clean
 * - DB queries now only fetch necessary fields (role, isActive)
 * - Remove operation uses `findOneAndDelete` for a single atomic call
 */

// ─── Save Job ───────────────────────────────────────────────────

/**
 * Save a job to the candidate's bookmarks.
 *
 * Flow:
 * 1. Verify user is a candidate (only need role)
 * 2. Verify job exists and is active (only need isActive flag)
 * 3. Create saved job document — duplicate → 409
 * 4. Return created document
 *
 * @param {string} userId - The authenticated user's ID
 * @param {string} jobId - The job's document ID
 * @returns {Promise<object>} Created saved job document
 */
export const saveJob = async (userId, jobId) => {
  // Verify user is a candidate (fetch only role for performance)
  const user = await User.findById(userId).select('role');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.role !== 'candidate') {
    throw new ApiError(403, 'Only candidates can save jobs');
  }

  // Verify job exists (fetch only isActive to minimise data transfer)
  const job = await Job.findById(jobId).select('isActive');
  if (!job) {
    throw new ApiError(404, 'Job not found');
  }

  // NEW: Reject saving inactive jobs — they shouldn't appear in bookmarks
  if (!job.isActive) {
    throw new ApiError(410, 'This job is no longer available');
  }

  // Create saved job — handle duplicate gracefully
  try {
    const savedJob = await SavedJob.create({
      candidate: userId,
      job: jobId,
    });
    return savedJob;
  } catch (error) {
    // Unique index on { candidate, job } throws E11000 on duplicate
    if (error.code === 11000) {
      throw new ApiError(409, 'Job already saved');
    }
    throw error; // Re-throw unexpected errors
  }
};

// ─── Get Saved Jobs ──────────────────────────────────────────────

/**
 * Get the current candidate's saved jobs.
 *
 * Populates job details with company info for display.
 * Supports pagination.
 *
 * @param {string} userId - The authenticated candidate's user ID
 * @param {object} queryParams - Express req.query object
 * @returns {Promise<{ savedJobs: object[], pagination: object }>}
 */
export const getSavedJobs = async (userId, queryParams) => {
  const { page = 1, limit = 10 } = queryParams;

  // Pagination
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  // Execute query
  const [savedJobs, total] = await Promise.all([
    SavedJob.find({ candidate: userId })
      .sort({ savedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate({
        path: 'job',
        select: 'title location jobType salary isActive',
        populate: {
          path: 'company',
          select: 'name logoUrl',
        },
      })
      .lean(),
    SavedJob.countDocuments({ candidate: userId }),
  ]);

  return {
    savedJobs,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.max(1, Math.ceil(total / limitNum)),
    },
  };
};

// ─── Remove Saved Job ───────────────────────────────────────────

/**
 * Remove a job from the candidate's saved list.
 *
 * @param {string} userId - The authenticated candidate's user ID
 * @param {string} jobId - The job's document ID
 * @returns {Promise<void>}
 */
export const removeSavedJob = async (userId, jobId) => {
  // NEW: Single atomic operation replaces findOne() + deleteOne()
  const result = await SavedJob.findOneAndDelete({
    candidate: userId,
    job: jobId,
  });

  if (!result) {
    throw new ApiError(404, 'This job is not in your saved list');
  }
};