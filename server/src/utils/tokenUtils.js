import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config/env.js';

/**
 * Token Utilities
 *
 * Centralizes all token-related operations:
 * - JWT access token (15min, contains userId + role)
 * - JWT refresh token (7 days, contains only userId)
 * - Crypto reset tokens (random bytes, SHA-256 hashed for DB storage)
 *
 * Why separate secrets for access and refresh tokens?
 * If one secret is compromised, the other remains secure. Defense in depth.
 */

// ─── JWT Token Generation ──────────────────────────────────────

/**
 * Generate a short-lived access token.
 * Payload: { userId, role } — role is included so the auth middleware
 * can check permissions without a DB query on every request.
 */
export const generateAccessToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    config.JWT_ACCESS_SECRET,
    { expiresIn: config.JWT_ACCESS_EXPIRY }
  );
};

/**
 * Generate a long-lived refresh token.
 * Payload: { userId } — minimal payload since this token's
 * only purpose is to get a new access token.
 */
export const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId },
    config.JWT_REFRESH_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRY }
  );
};

// ─── JWT Token Verification ────────────────────────────────────

/**
 * Verify and decode an access token.
 * Throws JsonWebTokenError or TokenExpiredError on failure
 * — the error middleware handles both.
 */
export const verifyAccessToken = (token) => {
  return jwt.verify(token, config.JWT_ACCESS_SECRET);
};

/**
 * Verify and decode a refresh token.
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.JWT_REFRESH_SECRET);
};

// ─── Password Reset Token ──────────────────────────────────────

/**
 * Generate a cryptographic reset token for password reset flow.
 *
 * Returns both the plain token (sent via email) and the hashed version
 * (stored in the database). On verification, the incoming plain token
 * is hashed and compared with the stored hash.
 *
 * Why hash before storing?
 * If the database is breached, attackers can't use the stored hashes
 * to reset anyone's password — they'd need the original unhashed token.
 */
export const generateResetToken = () => {
  const plainToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = hashToken(plainToken);
  return { plainToken, hashedToken };
};

/**
 * Hash a token using SHA-256.
 * Used to hash both refresh tokens and reset tokens before DB storage.
 */
export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
