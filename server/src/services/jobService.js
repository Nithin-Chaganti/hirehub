import Job from '../models/Job.js';
import Company from '../models/Company.js';
import ApiError from '../utils/ApiError.js';

/**
 * Job Service — Business Logic Layer
 *
 * Handles all job-related business operations:
 * - Job creation with company ownership verification
 * - Public job listing with search, filter, sort, and pagination
 * - Individual job retrieval with view counting
 * - Job updates with ownership enforcement
 * - Soft deletion (isActive = false) to preserve application references
 * - Recruiter's own job listing
 *
 * Key Design Decisions:
 * - Soft delete over hard delete: Applications reference jobs. Hard-deleting
 *   a job would orphan applications and break candidate dashboards.
 * - Fire-and-forget view counter: We don't await the view increment.
 *   Accuracy is acceptable for analytics; speed is not sacrificed.
 * - Company ownership on create: A recruiter can only post jobs under
 *   THEIR company. We verify via Company.findOne({ _id, createdBy }).
 * - Immutable fields on update: postedBy, company, applicationCount,
 *   and views cannot be modified through the update endpoint.
 * - Sort whitelist moved to module scope (Set) for better performance.
 * - Location regex is escaped to prevent regex injection from user input.
 */

// ─── Module-level constants ──────────────────────────────────────

// Whitelist of allowed sort fields — using a Set for O(1) lookup
// Moved outside the function to avoid recreating on every request.
const VALID_SORT_FIELDS = new Set([
  'createdAt',
  'salary.min',
  'salary.max',
  'title',
]);

// Simple regex special character escaper for user-supplied strings
// Prevents unintended regex patterns when searching by location
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// ─── Fields that must NEVER be updated through the update endpoint ──

const IMMUTABLE_JOB_FIELDS = [
  'postedBy',
  'company',
  'applicationCount',
  'views',
  'isActive',  // Controlled only via delete (soft-delete)
];

/**
 * Strip immutable fields from an update object.
 * Defense in depth — Joi's stripUnknown handles most cases,
 * but this catches any field that's in the schema but shouldn't
 * be user-modifiable.
 */
const stripImmutableFields = (data) => {
  const sanitized = { ...data };
  IMMUTABLE_JOB_FIELDS.forEach((field) => delete sanitized[field]);
  return sanitized;
};

// ─── Create Job ─────────────────────────────────────────────────

/**
 * Create a new job posting.
 *
 * The recruiter must own the specified company. This prevents
 * a recruiter from posting jobs under another recruiter's company.
 *
 * TODO: In the future, also verify the company is active (isActive: true)
 * if companies support soft delete / inactive states.
 *
 * @param {string} userId  — The authenticated recruiter's user ID
 * @param {object} jobData — Validated job fields (from Joi)
 * @returns {Promise<object>} Created job document (populated)
 */
export const createJob = async (userId, jobData) => {
  // Verify the recruiter owns this company
  const company = await Company.findOne({
    _id: jobData.company,
    createdBy: userId,
    // isActive: true,  // Future: ensure company is active before posting
  });

  if (!company) {
    throw new ApiError(
      403,
      'You can only post jobs under your own company'
    );
  }

  const job = await Job.create({
    ...jobData,
    postedBy: userId,
  });

  // Return populated job for the response without a second query
  const populatedJob = await job.populate([
    { path: 'company', select: 'name logo location' },
    { path: 'postedBy', select: 'name' },
  ]);

  return populatedJob;
};

// ─── Get All Jobs (Public) ──────────────────────────────────────

/**
 * List jobs with search, filter, sort, and pagination.
 *
 * This is the most complex query in the application. It combines:
 * - Full-text search on title + description (using MongoDB text index)
 * - Equality filters on location, jobType, experienceLevel, workMode
 * - Configurable sort (default: newest first) — sort field whitelist is
 *   stored in VALID_SORT_FIELDS Set for fast validation.
 * - Offset-based pagination with total count
 *
 * Only active jobs are returned (isActive: true).
 *
 * Security improvement: Location regex is escaped to prevent regex injection.
 *
 * TODO Future:
 * - Add salary range filters (minSalary, maxSalary)
 * - Improve text search ranking (sort by relevance then date)
 *
 * @param {object} queryParams — Express req.query object
 * @returns {Promise<{ jobs: object[], pagination: object }>}
 */
export const getAllJobs = async (queryParams) => {
  const {
    search,
    location,
    jobType,
    experienceLevel,
    workMode,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 10,
  } = queryParams;

  // ── Build filter object ────────────────────────────────────
  const filter = { isActive: true };

  if (search) {
    filter.$text = { $search: search };
  }

  if (location) {
    // Case-insensitive partial match for location — escaped to prevent regex injection
    filter.location = { $regex: new RegExp(escapeRegex(location), 'i') };
  }

  if (jobType) {
    filter.jobType = jobType;
  }

  if (experienceLevel) {
    filter.experienceLevel = experienceLevel;
  }

  if (workMode) {
    filter.workMode = workMode;
  }

  // ── Pagination ─────────────────────────────────────────────
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  // ── Sort ───────────────────────────────────────────────────
  const sortField = VALID_SORT_FIELDS.has(sortBy) ? sortBy : 'createdAt';
  const sortDirection = sortOrder === 'asc' ? 1 : -1;

  // ── Execute query ──────────────────────────────────────────
  const projection = search ? { score: { $meta: 'textScore' } } : {};
  const query = Job.find(filter, projection)
    .skip(skip)
    .limit(limitNum)
    .populate('company', 'name logo location')
    .populate('postedBy', 'name')
    .lean();                         // lean() for plain JS objects — faster

  if (search) {
    query.sort({ score: { $meta: 'textScore' }, createdAt: -1 });
  } else {
    query.sort({ [sortField]: sortDirection });
  }

  const [jobs, total] = await Promise.all([
    query,
    Job.countDocuments(filter),
    // NOTE: countDocuments with complex filters may be slow on huge datasets.
    // For millions of docs, consider aggregation or estimated counts later.
  ]);

  return {
    jobs,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.max(1, Math.ceil(total / limitNum)),
    },
  };
};

// ─── Get Job by ID ──────────────────────────────────────────────

/**
 * Get a single job with full details.
 *
 * Populates company (full details) and postedBy (name only).
 * Increments the view counter in a fire-and-forget pattern —
 * we don't await the update so the response isn't delayed.
 *
 * Safety: The fire-and-forget update now has a .catch(() => {}) to
 * prevent unhandled promise rejections if the update fails silently.
 *
 * @param {string} jobId — The job's document ID
 * @returns {Promise<object>} Job document with populated refs
 */
export const getJobById = async (jobId) => {
  const job = await Job.findById(jobId)
    .populate('company', 'name description website logo location')
    .populate('postedBy', 'name');

  if (!job) {
    throw new ApiError(404, 'Job not found');
  }

  // Fire-and-forget view increment — do not slow down the response.
  // .catch(() => {}) suppresses unhandled rejection if the DB update fails.
  void Job.updateOne({ _id: jobId }, { $inc: { views: 1 } })
    .exec()
    .catch(() => {
      // Silently ignore — view count accuracy is not critical.
    });

  return job;
};

// ─── Update Job ─────────────────────────────────────────────────

/**
 * Update a job posting.
 *
 * Only the recruiter who created the job can update it.
 * Immutable fields (postedBy, company, applicationCount, views, isActive)
 * are stripped before applying updates.
 *
 * @param {string} userId    — The authenticated recruiter's user ID
 * @param {string} jobId     — The job's document ID
 * @param {object} updateData — Validated update fields
 * @returns {Promise<object>} Updated job document
 */
export const updateJob = async (userId, jobId, updateData) => {
  const job = await Job.findById(jobId);

  if (!job) {
    throw new ApiError(404, 'Job not found');
  }

  // Ownership check
  if (job.postedBy.toString() !== userId.toString()) {
    throw new ApiError(403, 'You can only update your own job postings');
  }

  // Strip immutable fields
  const sanitizedData = stripImmutableFields(updateData);

  // Apply updates — Object.assign + save triggers Mongoose validators
  Object.assign(job, sanitizedData);
  await job.save();

  // Return populated job
  const updatedJob = await Job.findById(job._id)
    .populate('company', 'name logo location')
    .populate('postedBy', 'name');

  return updatedJob;
};

// ─── Delete Job (Soft Delete) ───────────────────────────────────

/**
 * Soft-delete a job by setting isActive to false.
 *
 * Why soft delete?
 * Applications reference jobs by ObjectId. If we hard-delete a job,
 * those references become dangling — candidates would see "Job not found"
 * in their application history. Soft delete preserves the data for
 * historical reference while hiding it from public listings.
 *
 * @param {string} userId — The authenticated recruiter's user ID
 * @param {string} jobId  — The job's document ID
 */
export const deleteJob = async (userId, jobId) => {
  const job = await Job.findById(jobId);

  if (!job) {
    throw new ApiError(404, 'Job not found');
  }

  // Ownership check
  if (job.postedBy.toString() !== userId.toString()) {
    throw new ApiError(403, 'You can only delete your own job postings');
  }

  // Already inactive — idempotent
  if (!job.isActive) {
    throw new ApiError(409, 'Job already deleted');
  }

  job.isActive = false;
  await job.save({ validateBeforeSave: false });
};

// ─── Get Recruiter's Jobs ───────────────────────────────────────

/**
 * Get all jobs posted by the authenticated recruiter.
 *
 * Supports pagination and optional isActive filter so recruiters
 * can view their active, inactive, or all job postings.
 *
 * @param {string} userId      — The authenticated recruiter's user ID
 * @param {object} queryParams — Express req.query object
 * @returns {Promise<{ jobs: object[], pagination: object }>}
 */
export const getRecruiterJobs = async (userId, queryParams) => {
  const {
    page = 1,
    limit = 10,
    isActive,
  } = queryParams;

  // ── Build filter ───────────────────────────────────────────
  const filter = { postedBy: userId };

  // Optional isActive filter — allow viewing active, inactive, or all
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }

  // ── Pagination ─────────────────────────────────────────────
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  // ── Execute query ──────────────────────────────────────────
  const [jobs, total] = await Promise.all([
    Job.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('company', 'name logo location')
      .lean(),
    Job.countDocuments(filter),
  ]);

  return {
    jobs,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  };
};