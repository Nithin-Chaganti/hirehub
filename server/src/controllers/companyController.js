import * as companyService from '../services/companyService.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';

/**
 * Company Controller — HTTP Request/Response Handlers
 *
 * Thin layer delegating to companyService.
 * Logo upload expects req.file from Multer middleware.
 */

// ─── Create Company ──────────────────────────────────────────────

/**
 * POST /api/v1/companies
 */
export const createCompany = asyncHandler(async (req, res) => {
  const company = await companyService.createCompany(req.user._id, req.body);

  res
    .status(201)
    .json(new ApiResponse(201, company, 'Company created successfully'));
});

// ─── Get Company ─────────────────────────────────────────────────

/**
 * GET /api/v1/companies/:id
 */
export const getCompany = asyncHandler(async (req, res) => {
  const company = await companyService.getCompanyById(req.params.id);

  res
    .status(200)
    .json(new ApiResponse(200, company, 'Company fetched successfully'));
});

// ─── Update Company ──────────────────────────────────────────────

/**
 * PUT /api/v1/companies/:id
 */
export const updateCompany = asyncHandler(async (req, res) => {
  const company = await companyService.updateCompany(
    req.user._id,
    req.params.id,
    req.body
  );

  res
    .status(200)
    .json(new ApiResponse(200, company, 'Company updated successfully'));
});

// ─── Upload Company Logo ─────────────────────────────────────────

/**
 * POST /api/v1/companies/logo
 */
export const uploadCompanyLogo = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'Please upload a logo image');
  }

  const result = await companyService.uploadCompanyLogo(
    req.user._id,
    req.file.buffer
  );

  res
    .status(200)
    .json(new ApiResponse(200, result, 'Company logo updated successfully'));
});

// ─── Get My Company ──────────────────────────────────────────────

/**
 * GET /api/v1/companies/me
 *
 * Returns the authenticated recruiter's own company profile.
 * Convenience endpoint for the recruiter dashboard.
 */
export const getMyCompany = asyncHandler(async (req, res) => {
  const company = await companyService.getMyCompany(req.user._id);

  res
    .status(200)
    .json(new ApiResponse(200, company, 'Company fetched successfully'));
});

// ─── Delete Company ──────────────────────────────────────────────

/**
 * DELETE /api/v1/companies/:id
 *
 * Deletes the recruiter's company profile and cleans up the logo
 * from Cloudinary. Ownership is verified in the service layer.
 */
export const deleteCompany = asyncHandler(async (req, res) => {
  await companyService.deleteCompany(req.user._id, req.params.id);

  res
    .status(200)
    .json(new ApiResponse(200, null, 'Company deleted successfully'));
});

