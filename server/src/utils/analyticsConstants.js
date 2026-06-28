/**
 * Analytics Constants
 *
 * Central location for all magic numbers, collection names,
 * status values, and allowed periods used by the analytics service.
 * Keeping these in one place makes the service lighter and easier
 * to maintain when adding new analytics features.
 */

// ─── Periods ──────────────────────────────────────────────────

export const VALID_PERIODS = ['7d', '30d', '90d', 'all'];
export const DEFAULT_PERIOD = '30d';

// ─── Application Statuses ─────────────────────────────────────

export const STATUSES = {
  PENDING: 'pending',
  REVIEWING: 'reviewing',
  SHORTLISTED: 'shortlisted',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
};

export const APPLICATION_STATUSES = Object.values(STATUSES);

// ─── Collection Names ─────────────────────────────────────────

export const COLLECTIONS = {
  JOBS: 'jobs',
  USERS: 'users',
};

// ─── Limits ───────────────────────────────────────────────────

export const TOP_JOBS_LIMIT = 5;
export const TREND_DAYS_LIMIT = 30;
export const TOP_SKILLS_LIMIT = 10;