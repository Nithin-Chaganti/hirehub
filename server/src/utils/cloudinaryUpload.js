import cloudinary from '../config/cloudinary.js';

/**
 * Cloudinary Upload Utility
 *
 * Provides helper functions for uploading files to and deleting files
 * from Cloudinary. Works with Multer's memory storage — accepts raw
 * Buffer objects and streams them to Cloudinary.
 *
 * Why stream instead of base64?
 * upload_stream() pipes the buffer directly to Cloudinary's API,
 * which is more memory-efficient than converting to base64 (which
 * increases the payload size by ~33%).
 *
 * Why return { url, publicId }?
 * The url is what users see (CDN link). The publicId is needed to
 * delete/replace the file later. Both are stored on the model.
 *
 * Interview Tip: "We store the Cloudinary publicId alongside the URL
 * in every model that has file uploads. This lets us delete the old
 * file when a user uploads a replacement — preventing orphaned files
 * from accumulating in our Cloudinary account."
 */

// ─── Upload ──────────────────────────────────────────────────────

/**
 * Upload a file buffer to Cloudinary.
 *
 * @param {Buffer} fileBuffer    — The file contents from Multer (req.file.buffer)
 * @param {string} folder        — Cloudinary folder path (e.g., 'hirehub/resumes')
 * @param {object} [options={}]  — Additional Cloudinary upload options
 * @param {string} [options.resource_type] — 'image', 'raw', or 'auto' (default: 'auto')
 * @param {string} [options.public_id]     — Custom public ID (Cloudinary generates one if omitted)
 * @returns {Promise<{ url: string, publicId: string }>}
 */
export const uploadToCloudinary = (fileBuffer, folder, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder,
      resource_type: 'auto', // auto-detect: image, raw (PDF), video
      ...options,
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        }
      }
    );

    // Write the buffer to the upload stream
    uploadStream.end(fileBuffer);
  });
};

// ─── Delete ──────────────────────────────────────────────────────

/**
 * Delete a file from Cloudinary by its public ID.
 *
 * Used when replacing a file (e.g., user uploads a new resume).
 * The old file's publicId is read from the model, deleted from
 * Cloudinary, then the model is updated with the new file's info.
 *
 * Silently succeeds if the publicId doesn't exist (idempotent).
 * This handles edge cases like manually deleted files.
 *
 * @param {string} publicId       — Cloudinary public ID of the file to delete
 * @param {string} [resourceType] — 'image', 'raw', or 'video' (default: 'image')
 * @returns {Promise<object>} Cloudinary deletion result
 */
export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  if (!publicId) return null;

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    return result;
  } catch (error) {
    // Log but don't throw — deletion failure shouldn't block the upload flow
    console.error(`Failed to delete Cloudinary resource ${publicId}:`, error.message);
    return null;
  }
};
