import Job from '../models/Job.js';
import Application from '../models/Application.js';
import SavedJob from '../models/SavedJob.js';
import ApiError from '../utils/ApiError.js';
import {
  VALID_PERIODS,
  DEFAULT_PERIOD,
  STATUSES,
  APPLICATION_STATUSES,
  COLLECTIONS,
  TOP_JOBS_LIMIT,
  TREND_DAYS_LIMIT,
  TOP_SKILLS_LIMIT,
} from '../utils/analyticsConstants.js';

/**
 * Analytics Service — MongoDB Aggregation Pipelines
 *
 * Provides analytics data using efficient aggregation pipelines.
 * Real-time calculations (no caching for MVP).
 *
 * Features:
 * - Recruiter analytics (hiring activity, application trends)
 * - Candidate analytics (job search activity, response rates)
 * - Job-specific analytics (performance metrics)
 *
 * Performance & Code Quality:
 * - Single $facet aggregation for recruiter and candidate analytics.
 * - Minimal `.select()` + `.lean()` for ownership and count queries.
 * - Shared status map helpers reduce repetition.
 * - All magic values moved to analyticsConstants.js.
 * - Period parameter validated in service (routes also validate for defense in depth).
 * - Response rate counts any non‑pending status as a recruiter response.
 * - Fallback default results prevent crashes when no data exists.
 * - Required database indexes documented.
 */

// ─── Helper Functions ───────────────────────────────────────────

/**
 * Create an empty status map with zero counts.
 */
const createEmptyStatusMap = () => {
  const map = {};
  APPLICATION_STATUSES.forEach((status) => {
    map[status] = 0;
  });
  return map;
};

/**
 * Fill a status map from aggregation result items.
 * Uses Object.hasOwn() for safe property checks.
 */
const fillStatusMap = (map, items) => {
  items.forEach((item) => {
    if (Object.hasOwn(map, item._id)) {
      map[item._id] = item.count;
    }
  });
  return map;
};

/**
 * Map recruiter application trend aggregation items to API format.
 */
const mapTrend = (items) =>
  items.map((item) => ({
    date: item._id,
    count: item.count,
  }));

/**
 * Map candidate application timeline aggregation items to API format.
 */
const mapCandidateTimeline = (items) =>
  items.map((item) => ({
    date: item._id,
    applied: item.applied,
    responses: item.responded,
  }));

/**
 * Parse period string to a Date representing the start of the window.
 * Throws an ApiError for invalid values.
 *
 * @param {string} period - '7d', '30d', '90d', 'all'
 * @returns {Date|null} Start date, or null if 'all'
 */
const parsePeriod = (period) => {
  if (!VALID_PERIODS.includes(period)) {
    throw new ApiError(400, `Invalid period. Must be one of: ${VALID_PERIODS.join(', ')}`);
  }

  if (period === 'all') return null;

  const days = Number(period.replace('d', ''));
  const now = new Date();
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
};

// ─── Aggregation Pipeline Builders ─────────────────────────────

const buildRecruiterPipeline = (recruiterId, dateFilter) => [
  {
    $lookup: {
      from: COLLECTIONS.JOBS,
      localField: 'job',
      foreignField: '_id',
      pipeline: [
        {
          $match: {
            postedBy: recruiterId,
            ...(dateFilter ? { createdAt: dateFilter } : {}),
          },
        },
      ],
      as: 'job',
    },
  },
  { $unwind: '$job' },
  {
    $facet: {
      overview: [
        {
          $group: {
            _id: null,
            totalApplications: { $sum: 1 },
            hired: {
              $sum: { $cond: [{ $eq: ['$status', STATUSES.ACCEPTED] }, 1, 0] },
            },
          },
        },
        {
          $lookup: {
            from: COLLECTIONS.JOBS,
            pipeline: [
              {
                $match: {
                  postedBy: recruiterId,
                  ...(dateFilter ? { createdAt: dateFilter } : {}),
                },
              },
              {
                $group: {
                  _id: null,
                  totalJobs: { $sum: 1 },
                  activeJobs: { $sum: { $cond: ['$isActive', 1, 0] } },
                },
              },
            ],
            as: 'jobsStats',
          },
        },
        { $unwind: { path: '$jobsStats', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            totalJobs: { $ifNull: ['$jobsStats.totalJobs', 0] },
            activeJobs: { $ifNull: ['$jobsStats.activeJobs', 0] },
            totalApplications: 1,
            hiredCandidates: '$hired',
          },
        },
      ],
      byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
      trend: [
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: TREND_DAYS_LIMIT },
      ],
      topJobs: [
        {
          $group: {
            _id: '$job',
            applicationCount: { $sum: 1 },
            hiredCount: {
              $sum: { $cond: [{ $eq: ['$status', STATUSES.ACCEPTED] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            jobId: '$_id._id',
            title: '$_id.title',
            applicationCount: 1,
            hiredCount: 1,
            hireRate: {
              $cond: [
                { $gt: ['$applicationCount', 0] },
                { $multiply: [{ $divide: ['$hiredCount', '$applicationCount'] }, 100] },
                0,
              ],
            },
          },
        },
        { $sort: { applicationCount: -1 } },
        { $limit: TOP_JOBS_LIMIT },
      ],
    },
  },
];

const buildCandidatePipeline = (candidateId) => [
  { $match: { candidate: candidateId } },
  {
    $facet: {
      overview: [
        {
          $group: {
            _id: null,
            totalApplications: { $sum: 1 },
            respondedCount: {
              $sum: {
                $cond: [{ $ne: ['$status', STATUSES.PENDING] }, 1, 0],
              },
            },
          },
        },
      ],
      byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
      timeline: [
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            applied: { $sum: 1 },
            responded: {
              $sum: {
                $cond: [{ $ne: ['$status', STATUSES.PENDING] }, 1, 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: TREND_DAYS_LIMIT },
      ],
      topSkills: [
        {
          $lookup: {
            from: COLLECTIONS.JOBS,
            localField: 'job',
            foreignField: '_id',
            as: 'job',
          },
        },
        { $unwind: '$job' },
        { $unwind: '$job.skills' },
        {
          $group: {
            _id: '$job.skills',
            demandCount: { $sum: 1 },
          },
        },
        { $sort: { demandCount: -1 } },
        { $limit: TOP_SKILLS_LIMIT },
      ],
    },
  },
];

const buildJobPipeline = (jobId) => [
  { $match: { job: jobId } },
  {
    $facet: {
      overview: [{ $group: { _id: null, totalApplications: { $sum: 1 } } }],
      byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
      skillDistribution: [
        {
          $lookup: {
            from: COLLECTIONS.USERS,
            localField: 'candidate',
            foreignField: '_id',
            as: 'candidate',
          },
        },
        { $unwind: '$candidate' },
        { $unwind: '$candidate.skills' },
        {
          $group: {
            _id: '$candidate.skills',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: TOP_SKILLS_LIMIT },
      ],
    },
  },
];

// ─── Default fallback results (used with destructuring) ────────

const DEFAULT_RECRUITER_ANALYTICS = {
  overview: [],
  byStatus: [],
  trend: [],
  topJobs: [],
};

const DEFAULT_CANDIDATE_ANALYTICS = {
  overview: [],
  byStatus: [],
  timeline: [],
  topSkills: [],
};

const DEFAULT_JOB_ANALYTICS = {
  overview: [],
  byStatus: [],
  skillDistribution: [],
};

// ─── Recruiter Analytics ────────────────────────────────────────

/**
 * Get analytics data for the recruiter's hiring activity.
 */
export const getRecruiterAnalytics = async (recruiterId, period = DEFAULT_PERIOD) => {
  const startDate = parsePeriod(period);
  const dateFilter = startDate ? { $gte: startDate } : {};

  const [result = DEFAULT_RECRUITER_ANALYTICS] =
    await Application.aggregate(buildRecruiterPipeline(recruiterId, dateFilter));

  const overview = result.overview[0] || {
    totalJobs: 0,
    activeJobs: 0,
    totalApplications: 0,
    hiredCandidates: 0,
  };

  const statusMap = fillStatusMap(createEmptyStatusMap(), result.byStatus);

  return {
    overview,
    applicationsByStatus: statusMap,
    applicationsTrend: mapTrend(result.trend),
    topPerformingJobs: result.topJobs,
  };
};

// ─── Candidate Analytics ────────────────────────────────────────

/**
 * Get analytics data for the candidate's job search activity.
 */
export const getCandidateAnalytics = async (candidateId) => {
  const [appResult = DEFAULT_CANDIDATE_ANALYTICS] =
    await Application.aggregate(buildCandidatePipeline(candidateId));

  const savedJobsCount = await SavedJob.countDocuments({ candidate: candidateId });

  const overviewData = appResult.overview[0] || {
    totalApplications: 0,
    respondedCount: 0,
  };
  const totalApplications = overviewData.totalApplications;
  const responseRate = totalApplications > 0
    ? Math.round((overviewData.respondedCount / totalApplications) * 100)
    : 0;

  const overview = {
    totalApplications,
    savedJobs: savedJobsCount,
    profileViews: null,
    responseRate,
  };

  const statusMap = fillStatusMap(createEmptyStatusMap(), appResult.byStatus);

  return {
    overview,
    applicationsByStatus: statusMap,
    applicationTimeline: mapCandidateTimeline(appResult.timeline),
    topMatchingSkills: appResult.topSkills.map((item) => ({
      skill: item._id,
      demandCount: item.demandCount,
    })),
  };
};

// ─── Job Analytics ───────────────────────────────────────────────

/**
 * Get analytics for a specific job posting.
 */
export const getJobAnalytics = async (recruiterId, jobId) => {
  const job = await Job.findOne({ _id: jobId, postedBy: recruiterId })
    .select('title createdAt applicationCount views')
    .lean();

  if (!job) {
    throw new ApiError(404, 'Job not found');
  }

  const daysActive = Math.ceil(
    (Date.now() - new Date(job.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  const [appStats = DEFAULT_JOB_ANALYTICS] =
    await Application.aggregate(buildJobPipeline(jobId));

  const totalApplications = appStats.overview[0]?.totalApplications || 0;

  const overview = {
    totalApplications,
    averageMatchScore: null,
    daysActive,
    viewCount: job.views || 0,
  };

  const statusMap = fillStatusMap(createEmptyStatusMap(), appStats.byStatus);

  return {
    jobId: job._id,
    title: job.title,
    overview,
    applicationsByStatus: statusMap,
    applicantSkillDistribution: appStats.skillDistribution.map((item) => ({
      skill: item._id,
      count: item.count,
    })),
  };
};