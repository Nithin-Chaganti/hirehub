import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinaryUpload.js';

/**
 * User Service — Business Logic Layer
 *
 * Handles all user profile management operations:
 * - Candidate profile viewing (by recruiters)
 * - Candidate profile updates (self)
 * - Recruiter profile updates (self)
 * - Password change with session invalidation
 * - Resume upload to Cloudinary
 *
 * Security Notes:
 * - Profile update methods strip immutable fields (email, role, password)
 *   before applying updates, even though Joi strips unknown fields too.
 *   Defense in depth — if a validator is misconfigured, the service
 *   layer still protects against privilege escalation.
 * - Password change clears the refresh token, forcing re-login on all
 *   devices. This ensures stolen sessions can't survive a password change.
 */

// ─── Fields that must NEVER be updated through profile endpoints ──

const IMMUTABLE_FIELDS = [
  'email',
  'role',
  'passwordHash',
  'refreshToken',
  'resetPasswordToken',
  'resetPasswordExpire',
  'isActive',
];

/**
 * Strip immutable fields from an update object.
 * Even if Joi's stripUnknown removes these, this is a safety net.
 */
const stripImmutableFields = (data) => {
  const sanitized = { ...data };
  IMMUTABLE_FIELDS.forEach((field) => delete sanitized[field]);
  return sanitized;
};

// ─── Get Candidate Profile ───────────────────────────────────────

/**
 * Get a candidate's public profile.
 * Used by recruiters to view candidate details.
 *
 * @param {string} candidateId — The candidate's user ID
 * @returns {Promise<object>} Candidate user document
 */
export const getCandidateProfile = async (candidateId) => {
  const candidate = await User.findById(candidateId);

  if (!candidate) {
    throw new ApiError(404, 'Candidate not found');
  }

  if (candidate.role !== 'candidate') {
    throw new ApiError(404, 'Candidate not found');
  }

  return candidate;
};

// ─── Update Candidate Profile ────────────────────────────────────

/**
 * Update the authenticated candidate's own profile.
 *
 * @param {string} userId     — The authenticated user's ID
 * @param {object} updateData — Validated profile fields
 * @returns {Promise<object>} Updated user document
 */
export const updateCandidateProfile = async (userId, updateData) => {
  const sanitizedData = stripImmutableFields(updateData);

  const user = await User.findByIdAndUpdate(
    userId,
    sanitizedData,
    {
      new: true,           // Return the updated document
      runValidators: true, // Run Mongoose schema validators on update
    }
  );

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return user;
};

// ─── Update Recruiter Profile ────────────────────────────────────

/**
 * Update the authenticated recruiter's own profile.
 *
 * Recruiters don't have skills or experience fields, but if the client
 * sends them, Joi's stripUnknown removes them. As a safety net, we
 * also strip them here.
 *
 * @param {string} userId     — The authenticated user's ID
 * @param {object} updateData — Validated profile fields
 * @returns {Promise<object>} Updated user document
 */
export const updateRecruiterProfile = async (userId, updateData) => {
  const sanitizedData = stripImmutableFields(updateData);

  // Extra safety: remove candidate-only fields
  delete sanitizedData.skills;
  delete sanitizedData.experience;
  delete sanitizedData.resume;

  const user = await User.findByIdAndUpdate(
    userId,
    sanitizedData,
    {
      new: true,
      runValidators: true,
    }
  );

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return user;
};

// ─── Change Password ─────────────────────────────────────────────

/**
 * Change the authenticated user's password.
 *
 * Flow:
 * 1. Fetch user with passwordHash (select: false by default)
 * 2. Verify current password matches
 * 3. Reject if new password === current password
 * 4. Set new password (pre-save hook will hash it)
 * 5. Clear refresh token (force re-login on all devices)
 *
 * Why clear the refresh token?
 * If the user is changing their password because they suspect their
 * account is compromised, any active sessions (refresh tokens) from
 * the attacker must be invalidated immediately.
 *
 * @param {string} userId          — The authenticated user's ID
 * @param {string} currentPassword — The user's current password
 * @param {string} newPassword     — The new password to set
 */
export const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId).select('+passwordHash');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Verify current password
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new ApiError(401, 'Current password is incorrect');
  }

  // Prevent setting the same password
  const isSamePassword = await user.comparePassword(newPassword);
  if (isSamePassword) {
    throw new ApiError(400, 'New password must be different from current password');
  }

  // Set new password — pre-save hook hashes it
  user.passwordHash = newPassword;

  // Invalidate all sessions
  user.refreshToken = null;

  await user.save();
};

// ─── Upload Resume ───────────────────────────────────────────────

/**
 * Upload or replace the candidate's resume.
 *
 * Flow:
 * 1. Upload the new file to Cloudinary (hirehub/resumes folder)
 * 2. If the user already has a resume, delete the old one from Cloudinary
 * 3. Update the user document with the new resume URL and publicId
 *
 * Why 'raw' resource type?
 * Cloudinary uses 'raw' for non-image, non-video files (PDFs, docs).
 * Without specifying 'raw', Cloudinary would try to process the PDF
 * as an image and fail.
 *
 * @param {string} userId     — The authenticated user's ID
 * @param {Buffer} fileBuffer — The PDF file buffer from Multer
 * @returns {Promise<{ resumeUrl: string }>}
 */
export const uploadResume = async (userId, fileBuffer) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Upload to Cloudinary
  const { url, publicId } = await uploadToCloudinary(
    fileBuffer,
    'hirehub/resumes',
    { resource_type: 'raw' }
  );

  // Delete old resume if it exists
  if (user.resume?.publicId) {
    await deleteFromCloudinary(user.resume.publicId, 'raw');
  }

  // Update user document
  user.resume = { url, publicId };
  await user.save({ validateBeforeSave: false });

  return { resumeUrl: url };
};
