import Job from '../models/Job.js';
import Application from '../models/Application.js';
import SavedJob from '../models/SavedJob.js';
import User from '../models/User.js';
import { getUnreadCount } from './notificationService.js';
import { calculateProfileCompleteness, computeJobMatchScore } from '../utils/talentUtils.js';
import { RECENT_ITEMS_LIMIT, RECOMMENDED_JOBS_POOL } from '../constants/talentConstants.js';

/**
 * Dashboard Service — Lightweight Home-Page Aggregations
 *
 * Provides snapshot data for recruiter and candidate dashboards.
 * Uses parallel queries for fast response times (no OpenAI calls).
 *
 * Phase 13 improvements:
 * - All magic numbers replaced with constants from dashboardConstants.
 * - Note added about future aggregation‑based optimization for
 *   reducing number of database queries (currently 6 per recruiter).
 */

const IN_PROGRESS_STATUSES = ['pending', 'reviewing', 'shortlisted'];

const getStartOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const mapProfilePicUrl = (user) => user?.profilePicture?.url || null;

/**
 * Fetch job IDs owned by a recruiter.
 *
 * @param {string} recruiterId
 * @returns {Promise<import('mongoose').Types.ObjectId[]>}
 */
const getRecruiterJobIds = async (recruiterId) => {
  const jobs = await Job.find({ postedBy: recruiterId }).select('_id').lean();
  return jobs.map((job) => job._id);
};

/**
 * Get aggregated dashboard data for the recruiter.
 *
 * @param {string} recruiterId
 * @returns {Promise<object>}
 */
export const getRecruiterDashboard = async (recruiterId) => {
  const jobIds = await getRecruiterJobIds(recruiterId);
  const startOfMonth = getStartOfMonth();
  const applicationFilter = jobIds.length > 0 ? { job: { $in: jobIds } } : { job: null };

  // TODO: Combine these 6 queries into 1-2 $facet aggregations for better performance
  const [
    activeJobs,
    totalApplications,
    pendingReview,
    hiredThisMonth,
    recentApplications,
    recentJobs,
    unreadNotifications,
  ] = await Promise.all([
    Job.countDocuments({ postedBy: recruiterId, isActive: true }),
    Application.countDocuments(applicationFilter),
    Application.countDocuments({ ...applicationFilter, status: 'pending' }),
    Application.countDocuments({
      ...applicationFilter,
      status: 'accepted',
      updatedAt: { $gte: startOfMonth },
    }),
    Application.find(applicationFilter)
      .sort({ appliedAt: -1 })
      .limit(RECENT_ITEMS_LIMIT)
      .populate('candidate', 'name profilePicture')
      .populate('job', 'title')
      .lean(),
    Job.find({ postedBy: recruiterId })
      .select('title applicationCount isActive createdAt')
      .sort({ createdAt: -1 })
      .limit(RECENT_ITEMS_LIMIT)
      .lean(),
    getUnreadCount(recruiterId),
  ]);

  return {
    stats: {
      activeJobs,
      totalApplications,
      pendingReview,
      hiredThisMonth,
    },
    recentApplications: recentApplications.map((application) => ({
      _id: application._id,
      candidate: {
        name: application.candidate?.name || null,
        profilePicUrl: mapProfilePicUrl(application.candidate),
      },
      job: {
        title: application.job?.title || null,
      },
      status: application.status,
      appliedAt: application.appliedAt,
    })),
    recentJobs,
    notifications: {
      unreadCount: unreadNotifications.count,
    },
  };
};

/**
 * Build recommended jobs using deterministic skill overlap scoring.
 *
 * @param {string[]} candidateSkills
 * @returns {Promise<object[]>}
 */
const getRecommendedJobs = async (candidateSkills) => {
  if (!candidateSkills?.length) {
    return [];
  }

  const jobs = await Job.find({
    isActive: true,
    requirements: { $in: candidateSkills },
  })
    .select('title location requirements company')
    .populate('company', 'name logoUrl')
    .sort({ createdAt: -1 })
    .limit(RECOMMENDED_JOBS_POOL)
    .lean();

  return jobs
    .map((job) => ({
      _id: job._id,
      title: job.title,
      company: {
        name: job.company?.name || null,
        logoUrl: job.company?.logoUrl || null,
      },
      matchScore: computeJobMatchScore(candidateSkills, job.requirements),
      location: job.location,
    }))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, RECENT_ITEMS_LIMIT);
};

/**
 * Get aggregated dashboard data for the candidate.
 *
 * @param {string} candidateId
 * @returns {Promise<object>}
 */
export const getCandidateDashboard = async (candidateId) => {
  const user = await User.findById(candidateId)
    .select('phone bio location skills experience resume profilePicture')
    .lean();

  const [
    totalApplications,
    inProgress,
    savedJobs,
    recentApplications,
    recommendedJobs,
    unreadNotifications,
  ] = await Promise.all([
    Application.countDocuments({ candidate: candidateId }),
    Application.countDocuments({
      candidate: candidateId,
      status: { $in: IN_PROGRESS_STATUSES },
    }),
    SavedJob.countDocuments({ candidate: candidateId }),
    Application.find({ candidate: candidateId })
      .sort({ appliedAt: -1 })
      .limit(RECENT_ITEMS_LIMIT)
      .populate({
        path: 'job',
        select: 'title',
        populate: {
          path: 'company',
          select: 'name logoUrl',
        },
      })
      .lean(),
    getRecommendedJobs(user?.skills || []),
    getUnreadCount(candidateId),
  ]);

  return {
    stats: {
      totalApplications,
      inProgress,
      savedJobs,
      profileCompleteness: calculateProfileCompleteness(user),
    },
    recentApplications: recentApplications.map((application) => ({
      _id: application._id,
      job: {
        _id: application.job?._id || null,
        title: application.job?.title || null,
        company: {
          name: application.job?.company?.name || null,
          logoUrl: application.job?.company?.logoUrl || null,
        },
      },
      status: application.status,
      appliedAt: application.appliedAt,
    })),
    recommendedJobs,
    notifications: {
      unreadCount: unreadNotifications.count,
    },
  };
};