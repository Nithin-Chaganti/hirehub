import Company from '../models/Company.js';
import Job from '../models/Job.js';
import ApiError from '../utils/ApiError.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinaryUpload.js';

/**
 * Company Service — Business Logic Layer
 *
 * Handles company profile CRUD, logo upload, and deletion.
 *
 * Ownership Model:
 * - Each recruiter can create exactly ONE company (1:1 relationship)
 * - Only the company creator (createdBy) can update/delete their company
 * - Company profiles are publicly viewable (no auth needed for GET)
 *
 * Interview Tip: "Each recruiter has exactly one company. We enforce this
 * with a check in createCompany() *and* a unique index on createdBy in the
 * database. The check gives a friendly 409, while the index eliminates the
 * race condition between simultaneous requests."
 */

// ─── Create Company ──────────────────────────────────────────────

/**
 * Create a company profile for the authenticated recruiter.
 *
 * @param {string} userId     — The recruiter's user ID
 * @param {object} companyData — Validated company fields
 * @returns {Promise<object>} New company document
 */
export const createCompany = async (userId, companyData) => {
  // Quick check to give a friendly 409 before hitting the unique index
  const existingCompany = await Company.findOne({ createdBy: userId });
  if (existingCompany) {
    throw new ApiError(409, 'You already have a company profile');
  }

  try {
    const company = await Company.create({
      ...companyData,
      createdBy: userId,
    });
    return company;
  } catch (error) {
    // Fallback: if a race condition bypassed the check, the unique index on `createdBy`
    // will throw a duplicate key error. We convert it into the same 409.
    // IMPORTANT: Ensure the Company model has:
    //   createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true }
    if (error.code === 11000) {
      throw new ApiError(409, 'You already have a company profile');
    }
    throw error;
  }
};

// ─── Get Company by ID ───────────────────────────────────────────

/**
 * Get a company's public profile by ID.
 *
 * @param {string} companyId — The company's document ID
 * @returns {Promise<object>} Company document
 */
export const getCompanyById = async (companyId) => {
  const company = await Company.findById(companyId);

  if (!company) {
    throw new ApiError(404, 'Company not found');
  }

  return company;
};

// ─── Get My Company ──────────────────────────────────────────────
// NEW: Recruiter dashboard convenience — returns the recruiter's own company.

/**
 * Get the authenticated recruiter's own company.
 *
 * @param {string} userId — The recruiter's user ID
 * @returns {Promise<object>} Company document
 */
export const getMyCompany = async (userId) => {
  const company = await Company.findOne({ createdBy: userId });

  if (!company) {
    throw new ApiError(404, 'You do not have a company profile yet');
  }

  return company;
};

// ─── Update Company ──────────────────────────────────────────────

/**
 * Update a company profile.
 *
 * Only the recruiter who created the company can update it.
 *
 * @param {string} userId      — The authenticated recruiter's user ID
 * @param {string} companyId   — The company's document ID
 * @param {object} updateData  — Validated update fields
 * @returns {Promise<object>} Updated company document
 */
export const updateCompany = async (userId, companyId, updateData) => {
  const company = await Company.findById(companyId);

  if (!company) {
    throw new ApiError(404, 'Company not found');
  }

  // Ownership check
  if (company.createdBy.toString() !== userId.toString()) {
    throw new ApiError(403, 'You can only update your own company');
  }

  delete updateData.createdBy;

  // Apply updates
  Object.assign(company, updateData);
  await company.save();

  return company;
};

// ─── Upload Company Logo ─────────────────────────────────────────

/**
 * Upload or replace the company logo.
 *
 * Instead of accepting a company ID, this endpoint automatically
 * finds the recruiter's company. Each recruiter has exactly one
 * company, so no ID is needed.
 *
 * @param {string} userId     — The authenticated recruiter's user ID
 * @param {Buffer} fileBuffer — The image file buffer from Multer
 * @returns {Promise<{ logoUrl: string }>}
 */
export const uploadCompanyLogo = async (userId, fileBuffer) => {
  const company = await Company.findOne({ createdBy: userId });

  if (!company) {
    throw new ApiError(404, 'Create a company profile first');
  }

  // Upload to Cloudinary
  const { url, publicId } = await uploadToCloudinary(
    fileBuffer,
    'hirehub/logos',
    { resource_type: 'image' }
  );

  // Delete old logo if it exists
  if (company.logo?.publicId) {
    try {
      await deleteFromCloudinary(company.logo.publicId, 'image');
    } catch (error) {
      console.error('Failed to delete company logo from Cloudinary:', error);
    }
  }

  // Update company document
  company.logo = { url, publicId };
  await company.save({ validateBeforeSave: false });

  return { logoUrl: url };
};

// ─── Delete Company ──────────────────────────────────────────────
// NEW: Allows a recruiter to delete their company, including logo cleanup.

/**
 * Delete a company profile.
 *
 * @param {string} userId    — The authenticated recruiter's user ID
 * @param {string} companyId — The company's document ID
 */
export const deleteCompany = async (userId, companyId) => {
  const company = await Company.findById(companyId);

  if (!company) {
    throw new ApiError(404, 'Company not found');
  }

  // Ownership check
  if (company.createdBy.toString() !== userId.toString()) {
    throw new ApiError(403, 'You can only delete your own company');
  }

  const activeJobs = await Job.exists({ company: company._id, isActive: true });
  if (activeJobs) {
    throw new ApiError(409, 'Delete all active jobs before deleting company');
  }

  // Delete logo from Cloudinary if it exists
  if (company.logo?.publicId) {
    try {
      await deleteFromCloudinary(company.logo.publicId, 'image');
    } catch (error) {
      console.error('Failed to delete company logo from Cloudinary:', error);
    }
  }

  // Remove the company document — no need to return anything
  await company.deleteOne();
};