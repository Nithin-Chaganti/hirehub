import { v2 as cloudinary } from 'cloudinary';
import config from './env.js';

/**
 * Cloudinary SDK Configuration
 *
 * Configures the Cloudinary Node.js SDK with credentials from environment variables.
 * Used for:
 * - Uploading candidate resumes (PDF) to cloud storage
 * - Uploading company logos (images) to cloud storage
 * - Generating CDN URLs for uploaded files
 *
 * Why Cloudinary over local filesystem?
 * Render (our hosting platform) uses ephemeral filesystems — files uploaded to the
 * server's disk are lost on every redeploy. Cloudinary provides persistent storage
 * with CDN delivery and a generous free tier (25 credits/month).
 */

cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

export default cloudinary;
