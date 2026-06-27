import multer from 'multer';
import ApiError from '../utils/ApiError.js';

/**
 * Upload Middleware — Multer Configuration
 *
 * Configures Multer for file uploads using memory storage (buffers).
 * Files are stored in memory as Buffer objects, which are then streamed
 * directly to Cloudinary — no temporary files on disk.
 *
 * Why memory storage?
 * Render uses an ephemeral filesystem, so writing temp files to disk
 * would be unreliable. Memory storage also avoids cleanup concerns.
 * For our use case (PDFs up to 5MB, images up to 2MB), memory usage
 * is negligible.
 *
 * Why separate upload functions?
 * Each upload type has different constraints (file types, sizes).
 * Separate functions make the route definitions self-documenting:
 *   router.post('/resume', uploadResume, controller.uploadResume)
 *   router.post('/logo', uploadLogo, controller.uploadLogo)
 *
 * Interview Tip: "We use Multer with memory storage and stream buffers
 * directly to Cloudinary. This avoids temp files on Render's ephemeral
 * filesystem and keeps the upload pipeline clean."
 */

// ─── Storage Configuration ────────────────────────────────────────

/**
 * Memory storage — files are available as req.file.buffer
 * No disk I/O, no temp file cleanup, no path configuration.
 */
const storage = multer.memoryStorage();

// ─── File Filter Factories ────────────────────────────────────────

/**
 * Creates a Multer fileFilter that only allows specified MIME types.
 * Returns an ApiError with a user-friendly message if the file type
 * doesn't match.
 *
 * @param {string[]} allowedMimes — Array of allowed MIME types
 * @param {string} errorMessage   — User-friendly error message
 * @returns {Function} Multer fileFilter function
 */
const createFileFilter = (allowedMimes, errorMessage) => {
  return (req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, errorMessage), false);
    }
  };
};

// ─── Resume Upload ────────────────────────────────────────────────

/**
 * Multer middleware for resume upload.
 *
 * Constraints:
 * - Single file only (field name: 'resume')
 * - PDF only (application/pdf)
 * - Max 5MB
 *
 * Why PDF only?
 * PDFs preserve formatting across devices and are the industry standard
 * for resumes. Allowing DOCX would require server-side rendering for
 * preview, adding complexity without clear benefit.
 */
const resumeUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: createFileFilter(
    ['application/pdf'],
    'Only PDF files are allowed'
  ),
});

export const uploadResume = resumeUpload.single('resume');

// ─── Logo Upload ──────────────────────────────────────────────────

/**
 * Multer middleware for company logo upload.
 *
 * Constraints:
 * - Single file only (field name: 'logo')
 * - JPEG, PNG, or WebP only
 * - Max 2MB
 */
const logoUpload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: createFileFilter(
    ['image/jpeg', 'image/png', 'image/webp'],
    'Only JPEG, PNG, and WebP images are allowed'
  ),
});

export const uploadLogo = logoUpload.single('logo');

// ─── Profile Picture Upload ──────────────────────────────────────

/**
 * Multer middleware for user profile picture upload.
 *
 * Same constraints as logo upload:
 * - Single file only (field name: 'profilePicture')
 * - JPEG, PNG, or WebP only
 * - Max 2MB
 */
const profilePicUpload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: createFileFilter(
    ['image/jpeg', 'image/png', 'image/webp'],
    'Only JPEG, PNG, and WebP images are allowed'
  ),
});

export const uploadProfilePicture = profilePicUpload.single('profilePicture');
