import User from '../models/User.js';
import Job from '../models/Job.js';
import ApiError from '../utils/ApiError.js';
import {
  parseSkillsParam,
  escapeRegex,
  mapCandidateSearchResult,
  mapCandidateDetail,
  buildMatchingJobs,
  deriveExperienceLevel,
} from '../utils/talentUtils.js';
import { MAX_PAGE_LIMIT, MATCHING_JOBS_LIMIT } from '../constants/talentConstants.js';

/**
 * Talent Service — Candidate Search + Profile Context
 *
 * Provides recruiter‑facing talent search with skill matching and
 * candidate detail views enriched with job match scores.
 *
 * Phase 13 improvements:
 * - Experience filtering now performed inside MongoDB aggregation using
 *   a derived `experienceLevel` field (based on array length heuristic).
 *   For full accuracy, a pre‑computed `totalExperienceYears` should be
 *   stored on the User document in production.
 * - No more in‑memory filtering or fetching of all candidates; pagination
 *   handled entirely by MongoDB’s $facet.
 * - Pre‑computed matched skills / percentage passed to mapping function
 *   via options object, eliminating duplicate work.
 */

/**
 * Build the $addFields stage that derives experienceLevel from the
 * length of the experience array (0 → fresher, 1‑2 → mid, 3+ → senior).
 * This matches the pre‑improvement logic and stays inside MongoDB.
 */
const deriveExperienceLevelInAggregation = () => ({
  $addFields: {
    experienceLevel: {
      $switch: {
        branches: [
          { case: { $lte: [{ $size: { $ifNull: ['$experience', []] } }, 0] }, then: 'fresher' },
          { case: { $lte: [{ $size: { $ifNull: ['$experience', []] } }, 2] }, then: 'mid' },
        ],
        default: 'senior',
      },
    },
  },
});

/**
 * Search candidates by skills, location, and experience level.
 *
 * @param {string} recruiterId - Authenticated recruiter (reserved for future scoping)
 * @param {object} queryParams - Express req.query
 * @returns {Promise<{ candidates: object[], pagination: object }>}
 */
export const searchTalent = async (recruiterId, queryParams) => {
  void recruiterId;

  const {
    skills,
    location,
    experienceLevel,
    page = 1,
    limit = 10,
    sortBy = 'relevance',
  } = queryParams;

  const searchSkills = parseSkillsParam(skills);
  const hasLocation = Boolean(location && String(location).trim());
  const hasExperienceLevel = Boolean(experienceLevel);

  if (searchSkills.length === 0 && !hasLocation && !hasExperienceLevel) {
    throw new ApiError(
      400,
      'Please provide at least one search criteria (skills, location, or experience)'
    );
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(limit, 10) || 10));

  // ── Base match: skills + location ──
  const matchStage = { role: 'candidate', isActive: true };
  if (searchSkills.length > 0) matchStage.skills = { $in: searchSkills };
  if (hasLocation) {
    matchStage.location = {
      $regex: new RegExp(escapeRegex(String(location).trim()), 'i'),
    };
  }

  // ── Build pipeline ──
  const pipeline = [
    { $match: matchStage },

    // Compute experience level from array length (kept inside MongoDB)
    deriveExperienceLevelInAggregation(),
  ];

  // Filter by experience level if requested
  if (hasExperienceLevel) {
    pipeline.push({ $match: { experienceLevel } });
  }

  // Compute matched skills & percent
  pipeline.push({
    $addFields: {
      matchedSkills: searchSkills.length > 0
        ? { $setIntersection: ['$skills', searchSkills] }
        : [],
      skillMatchPercent: searchSkills.length > 0
        ? {
            $round: [
              {
                $multiply: [
                  {
                    $divide: [
                      { $size: { $setIntersection: ['$skills', searchSkills] } },
                      searchSkills.length,
                    ],
                  },
                  100,
                ],
              },
              0,
            ],
          }
        : 0,
    },
  });

  // Sort
  const sortOrder = sortBy === 'createdAt'
    ? { createdAt: -1 }
    : { skillMatchPercent: -1, createdAt: -1 };
  pipeline.push({ $sort: sortOrder });

  // Paginate using $facet
  pipeline.push({
    $facet: {
      data: [
        { $skip: (pageNum - 1) * limitNum },
        { $limit: limitNum },
        {
          $project: {
            name: 1,
            location: 1,
            profilePicture: 1,
            skills: 1,
            experience: 1,
            experienceLevel: 1,
            matchedSkills: 1,
            skillMatchPercent: 1,
            createdAt: 1,
          },
        },
      ],
      totalCount: [{ $count: 'count' }],
    },
  });

  const [result] = await User.aggregate(pipeline);
  const candidates = (result?.data || []).map((doc) =>
    mapCandidateSearchResult(doc, searchSkills, {
      matchedSkills: doc.matchedSkills,
      skillMatchPercent: doc.skillMatchPercent,
    })
  );
  const total = result?.totalCount?.[0]?.count || 0;

  return {
    candidates,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.max(1, Math.ceil(total / limitNum)),
    },
  };
};

/**
 * Get detailed candidate profile with matching jobs for the recruiter.
 */
export const getCandidateDetail = async (recruiterId, candidateId) => {
  const [candidate, recruiterJobs] = await Promise.all([
    User.findOne({ _id: candidateId, role: 'candidate', isActive: true })
      .select('name email phone bio location profilePicture resume skills experience createdAt')
      .lean(),
    Job.find({ postedBy: recruiterId, isActive: true })
      .select('title requirements')
      .lean(),
  ]);

  if (!candidate) throw new ApiError(404, 'Candidate not found');

  const matchingJobs = buildMatchingJobs(
    candidate.skills,
    recruiterJobs,
    MATCHING_JOBS_LIMIT
  );

  return mapCandidateDetail(
    { ...candidate, experienceLevel: deriveExperienceLevel(candidate.experience) },
    matchingJobs
  );
};