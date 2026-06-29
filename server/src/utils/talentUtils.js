import { EXPERIENCE_LEVELS } from '../constants/jobConstants.js';
import { PROFILE_COMPLETENESS_WEIGHTS } from '../constants/talentConstants.js';

/**
 * Talent Utils — Shared helpers for talent search and dashboard modules.
 *
 * Provides skill matching, experience derivation, API response mapping,
 * and profile completeness scoring used by talentService and dashboardService.
 *
 * Phase 13 improvements:
 * - Experience level can now be derived from total years across all entries
 *   (via computeTotalExperienceYears). Fallback is 0 when parsing fails,
 *   avoiding misleading guesses.
 * - mapCandidateSearchResult accepts an options object for pre‑computed
 *   matched skills / percentage, preventing duplicate work.
 */

// ─── Skill Parsing ───────────────────────────────────────────────

/**
 * Parse comma-separated skills query param into normalized lowercase array.
 */
export const parseSkillsParam = (skillsString) => {
  if (!skillsString || typeof skillsString !== 'string') return [];
  return [...new Set(
    skillsString.split(',')
      .map(skill => skill.trim().toLowerCase())
      .filter(Boolean)
  )];
};

/**
 * Escape special regex characters for safe location matching.
 */
export const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── Skill Matching ──────────────────────────────────────────────

const normalizeSkillList = (skills) =>
  (skills || []).map(s => String(s).trim().toLowerCase()).filter(Boolean);

export const computeSkillMatch = (searchSkills, candidateSkills) => {
  const normalizedSearch = normalizeSkillList(searchSkills);
  const normalizedCandidate = normalizeSkillList(candidateSkills);
  if (normalizedSearch.length === 0) return { matchedSkills: [], skillMatchPercent: 0 };
  const candidateSet = new Set(normalizedCandidate);
  const matchedSkills = normalizedSearch.filter(skill => candidateSet.has(skill));
  const skillMatchPercent = Math.round((matchedSkills.length / normalizedSearch.length) * 100);
  return { matchedSkills, skillMatchPercent };
};

export const computeJobMatchScore = (candidateSkills, jobRequirements) => {
  const normalizedRequirements = normalizeSkillList(jobRequirements);
  if (normalizedRequirements.length === 0) return 0;
  const { matchedSkills } = computeSkillMatch(normalizedRequirements, candidateSkills);
  return Math.round((matchedSkills.length / normalizedRequirements.length) * 100);
};

// ─── Experience Helpers ──────────────────────────────────────────

/**
 * Attempt to extract total years of experience from an array of experience entries.
 * Each entry may have a `duration` string like "2 years", "6 months".
 * Returns 0 if no duration could be parsed (no fallback to array length).
 */
export const computeTotalExperienceYears = (experienceArray) => {
  if (!Array.isArray(experienceArray) || experienceArray.length === 0) return 0;
  let totalYears = 0;
  for (const entry of experienceArray) {
    if (entry.duration) {
      const str = String(entry.duration).toLowerCase();
      const yearMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i);
      if (yearMatch) { totalYears += parseFloat(yearMatch[1]); continue; }
      const monthMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:months?|mos?)/i);
      if (monthMatch) { totalYears += parseFloat(monthMatch[1]) / 12; continue; }
    }
  }
  return totalYears;
};

/**
 * Derive experience level based on total years (accurate when duration is available).
 * In production, store this pre‑computed on the User document.
 */
export const deriveExperienceLevel = (experienceArray) => {
  const totalYears = computeTotalExperienceYears(experienceArray);
  if (totalYears === 0) return 'fresher';
  if (totalYears <= 5) return 'mid';
  return 'senior';
};

/**
 * Apply derived experience fields onto a candidate user document.
 *
 * @param {object} user
 */
export const applyExperienceFieldSync = (user) => {
  if (user.role !== 'candidate') return;

  user.totalExperienceYears = computeTotalExperienceYears(user.experience);
  user.experienceLevel = deriveExperienceLevel(user.experience);
};

/**
 * Format a short experience summary from the most recent entry.
 */
export const formatExperienceSummary = (experienceArray) => {
  if (!Array.isArray(experienceArray) || experienceArray.length === 0) return null;
  const latest = experienceArray[0];
  const parts = [];
  if (latest.duration) parts.push(latest.duration);
  if (latest.company) parts.push(`at ${latest.company}`);
  if (latest.role) parts.push(`as ${latest.role}`);
  return parts.length > 0 ? parts.join(' ') : null;
};

// ─── API Response Mapping ────────────────────────────────────────

const getProfilePicUrl = (user) => user?.profilePicture?.url || user?.profilePicUrl || null;
const getResumeUrl = (user) => user?.resume?.url || user?.resumeUrl || null;

/**
 * Map a candidate document to talent search list item shape.
 * Accepts optional options object with pre‑computed matchedSkills / percent.
 */
export const mapCandidateSearchResult = (doc, searchSkills, options = {}) => {
  const { matchedSkills = null, skillMatchPercent = null } = options;
  const computed = (matchedSkills !== null && skillMatchPercent !== null)
    ? { matchedSkills, skillMatchPercent }
    : computeSkillMatch(searchSkills, doc.skills);

  return {
    _id: doc._id,
    name: doc.name,
    location: doc.location || null,
    profilePicUrl: getProfilePicUrl(doc),
    skills: doc.skills || [],
    experienceLevel: doc.experienceLevel || deriveExperienceLevel(doc.experience),
    matchedSkills: computed.matchedSkills,
    skillMatchPercent: computed.skillMatchPercent,
    experienceSummary: formatExperienceSummary(doc.experience),
  };
};

export const mapCandidateDetail = (doc, matchingJobs) => ({
  _id: doc._id,
  name: doc.name,
  email: doc.email,
  phone: doc.phone || null,
  bio: doc.bio || null,
  location: doc.location || null,
  profilePicUrl: getProfilePicUrl(doc),
  resumeUrl: getResumeUrl(doc),
  skills: doc.skills || [],
  experience: doc.experience || [],
  matchingJobs,
  createdAt: doc.createdAt,
});

export const buildMatchingJobs = (candidateSkills, jobs, limit = 5) =>
  jobs
    .map(job => ({
      jobId: job._id,
      title: job.title,
      matchScore: computeJobMatchScore(candidateSkills, job.requirements),
    }))
    .filter(item => item.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);

// ─── Profile Completeness ────────────────────────────────────────

export const calculateProfileCompleteness = (user) => {
  if (!user) return 0;
  let score = 0;
  if (user.phone) score += PROFILE_COMPLETENESS_WEIGHTS.phone;
  if (user.bio) score += PROFILE_COMPLETENESS_WEIGHTS.bio;
  if (user.location) score += PROFILE_COMPLETENESS_WEIGHTS.location;
  if (Array.isArray(user.skills) && user.skills.length > 0) score += PROFILE_COMPLETENESS_WEIGHTS.skills;
  if (Array.isArray(user.experience) && user.experience.length > 0) score += PROFILE_COMPLETENESS_WEIGHTS.experience;
  if (user.resume?.url) score += PROFILE_COMPLETENESS_WEIGHTS.resume;
  if (user.profilePicture?.url) score += PROFILE_COMPLETENESS_WEIGHTS.profilePicture;
  return score;
};

export { EXPERIENCE_LEVELS };