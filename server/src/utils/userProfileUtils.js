import User from '../models/User.js';
import {
  computeTotalExperienceYears,
  deriveExperienceLevel,
} from './talentUtils.js';

/**
 * Fire-and-forget profile view counter for recruiter profile lookups.
 *
 * @param {string} candidateId
 */
export const recordProfileView = (candidateId) => {
  void User.updateOne(
    { _id: candidateId, role: 'candidate' },
    { $inc: { profileViews: 1 } }
  ).catch((error) => {
    console.error('Profile view increment failed:', error.message);
  });
};

/**
 * Backfill experienceLevel and totalExperienceYears for existing candidates.
 * Runs once after DB connect; safe to re-run (idempotent).
 */
export const syncAllCandidateExperienceFields = async () => {
  const candidates = await User.find({ role: 'candidate' })
    .select('experience experienceLevel totalExperienceYears')
    .lean();

  const bulkOps = [];

  for (const candidate of candidates) {
    const totalExperienceYears = computeTotalExperienceYears(candidate.experience);
    const experienceLevel = deriveExperienceLevel(candidate.experience);

    if (
      candidate.totalExperienceYears === totalExperienceYears &&
      candidate.experienceLevel === experienceLevel
    ) {
      continue;
    }

    bulkOps.push({
      updateOne: {
        filter: { _id: candidate._id },
        update: { $set: { totalExperienceYears, experienceLevel } },
      },
    });
  }

  if (bulkOps.length > 0) {
    await User.bulkWrite(bulkOps);
    console.log(`Synced experience fields for ${bulkOps.length} candidate(s)`);
  }
};
