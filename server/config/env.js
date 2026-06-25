import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Environment Configuration
 *
 * Loads and validates all required environment variables at startup.
 * If any are missing, the server crashes immediately with a clear error
 * listing exactly which variables need to be set.
 *
 * Why crash early?
 * A missing MONGODB_URI will cause a cryptic Mongoose error 30 seconds
 * after startup when the first request hits. By validating at boot time,
 * developers get immediate, actionable feedback.
 *
 * Interview Tip: "We validate env vars at startup using a fail-fast pattern.
 * The server refuses to start if secrets are missing — it's better to fail
 * during deployment than to serve 500 errors to users 10 minutes later."
 */

// Load .env file from the server directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// ─── Required Environment Variables ────────────────────────────

const requiredVars = [
  'PORT',
  'NODE_ENV',
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ACCESS_EXPIRY',
  'JWT_REFRESH_EXPIRY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'GEMINI_API_KEY',
  'CLIENT_URL',
];

const missingVars = requiredVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('\n❌ FATAL: Missing required environment variables:\n');
  missingVars.forEach((varName) => {
    console.error(`   • ${varName}`);
  });
  console.error('\n   Copy .env.example to .env and fill in all values.\n');
  process.exit(1);
}

// ─── Typed Config Object ───────────────────────────────────────

/**
 * Frozen config object — prevents accidental mutation.
 * All env vars are accessed through this object, never directly from process.env.
 */
const config = Object.freeze({
  PORT: parseInt(process.env.PORT, 10) || 5000,
  NODE_ENV: process.env.NODE_ENV,

  // Database
  MONGODB_URI: process.env.MONGODB_URI,

  // JWT
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY,
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY,

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

  // Email (SMTP)
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,

  // AI
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,

  // Client
  CLIENT_URL: process.env.CLIENT_URL,
});

export default config;
