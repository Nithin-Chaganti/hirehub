/**
 * Talent & Dashboard Constants
 *
 * Central location for limits, weights, and configuration used by
 * dashboardService, talentService, and talentUtils.
 */

// ─── Limits ──────────────────────────────────────────────────

export const RECENT_ITEMS_LIMIT = 5;          // dashboard recent cards
export const RECOMMENDED_JOBS_POOL = 20;      // candidates to fetch for scoring
export const MATCHING_JOBS_LIMIT = 5;         // top matching jobs on candidate detail

// ─── Search Pagination ───────────────────────────────────────

export const MAX_PAGE_LIMIT = 50;

// ─── Profile Completeness Weights ─────────────────────────────

export const PROFILE_COMPLETENESS_WEIGHTS = {
  phone: 10,
  bio: 15,
  location: 15,
  skills: 20,
  experience: 15,
  resume: 15,
  profilePicture: 10,
};