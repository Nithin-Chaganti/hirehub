import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import {
  generateResetToken,
  hashToken,
  verifyRefreshToken,
} from '../utils/tokenUtils.js';
import { sendPasswordResetEmail } from './emailService.js';
import config from '../config/env.js';

/**
 * Auth Service — Business Logic Layer
 *
 * Contains all authentication and password management logic.
 * No req/res references — pure business logic that receives data
 * and returns results or throws ApiError.
 *
 * Token Strategy:
 * - Access tokens: Short-lived (15min), contain userId + role
 * - Refresh tokens: Long-lived (7 days), stored as SHA-256 hash in DB
 * - Token rotation: Each refresh invalidates the old token
 * - Reuse detection: If a used refresh token appears again, all sessions are killed
 *
 * Model Interaction Notes (from Phase 4):
 * - User.passwordHash accepts raw password; pre-save hook hashes it
 * - Login must query: .select('+passwordHash')
 * - Refresh must query: .select('+refreshToken')
 * - Reset must query: .select('+resetPasswordToken +resetPasswordExpire')
 * - hashToken() from tokenUtils.js hashes refresh/reset tokens before DB storage
 * - User.toJSON() transform strips sensitive fields automatically
 */

// ─── Constants ───────────────────────────────────────────────────

const RESET_TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

// ─── Register ────────────────────────────────────────────────────

/**
 * Register a new user.
 *
 * Flow:
 * 1. Check if email already exists (friendly error vs cryptic MongoDB 11000)
 * 2. Create user (passwordHash field receives raw password; pre-save hook hashes it)
 * 3. Generate access + refresh tokens
 * 4. Store hashed refresh token in DB
 * 5. Return user + tokens
 *
 * Why check email before User.create()?
 * The unique index on email will reject duplicates with a MongoDB 11000 error,
 * which errorMiddleware handles generically ("Email already exists").
 * But we check explicitly to provide a more descriptive message and
 * to return a 409 status code instead of relying on error middleware mapping.
 *
 * @param {object} userData - { name, email, password, role }
 * @returns {Promise<{ user: object, accessToken: string, refreshToken: string }>}
 */
export const register = async ({ name, email, password, role }) => {
  // 1. Check for existing email
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, 'Email already registered');
  }

  // 2. Create user — passwordHash receives the raw password
  //    The pre-save hook in User.js will hash it before persisting
  const user = await User.create({
    name,
    email,
    passwordHash: password,
    role,
  });

  // 3. Generate tokens
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  // 4. Store hashed refresh token
  user.refreshToken = hashToken(refreshToken);
  await user.save({ validateBeforeSave: false });

  // 5. Return — user.toJSON() strips sensitive fields
  return {
    user: user.toJSON(),
    accessToken,
    refreshToken,
  };
};

// ─── Login ───────────────────────────────────────────────────────

/**
 * Authenticate a user with email and password.
 *
 * Why the same error message for "user not found" and "wrong password"?
 * To prevent user enumeration attacks. If we said "Email not found" vs
 * "Wrong password", attackers could discover valid emails by testing
 * different addresses and observing the error messages.
 *
 * @param {object} credentials - { email, password }
 * @returns {Promise<{ user: object, accessToken: string, refreshToken: string }>}
 */
export const login = async ({ email, password }) => {
  // Find user with password field included (select: false by default)
  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // Compare plaintext password with stored hash
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // Check if account is deactivated or suspended
  if (!user.isActive) {
    throw new ApiError(403, 'Your account has been deactivated. Please contact support.');
  }

  // Generate new token pair (token rotation)
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  // Store hashed refresh token — old token is now invalid
  user.refreshToken = hashToken(refreshToken);
  await user.save({ validateBeforeSave: false });

  return {
    user: user.toJSON(),
    accessToken,
    refreshToken,
  };
};

// ─── Refresh Token ───────────────────────────────────────────────

/**
 * Issue a new access token using a valid refresh token.
 *
 * Implements Refresh Token Rotation with Reuse Detection:
 * - Each refresh generates a NEW refresh token and invalidates the old one
 * - If a previously-used refresh token appears again, it means the token
 *   was stolen — we clear ALL sessions by nullifying the stored token
 *
 * Why import verifyRefreshToken here instead of at the top?
 * It IS imported at the top via tokenUtils.js. The verify call here
 * will throw JsonWebTokenError or TokenExpiredError, which our
 * errorMiddleware handles with proper 401 responses.
 *
 * @param {string} incomingRefreshToken — Raw refresh token from the cookie
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
export const refreshAccessToken = async (incomingRefreshToken) => {
  if (!incomingRefreshToken) {
    throw new ApiError(401, 'Session expired. Please log in again.');
  }

  // 1. Verify the JWT signature and expiry
  let decoded;

  try {
    decoded = verifyRefreshToken(incomingRefreshToken);
  } catch {
    throw new ApiError(401, 'Session expired. Please log in again.');
  }

  // 2. Find the user and their stored refresh token hash
  const user = await User.findById(decoded.userId).select('+refreshToken');

  if (!user) {
    throw new ApiError(401, 'Session expired. Please log in again.');
  }

  // 3. Hash the incoming token and compare with stored hash
  const incomingTokenHash = hashToken(incomingRefreshToken);

  if (user.refreshToken !== incomingTokenHash) {
    // Reuse detected! Someone is using an old token.
    // Clear all sessions as a security measure.
    user.refreshToken = null;
    await user.save({ validateBeforeSave: false });

    throw new ApiError(401, 'Session expired. Please log in again.');
  }

  // 4. Rotate: generate new token pair
  const accessToken = user.generateAccessToken();
  const newRefreshToken = user.generateRefreshToken();

  // 5. Store the new hashed refresh token — old one is now dead
  user.refreshToken = hashToken(newRefreshToken);
  await user.save({ validateBeforeSave: false });

  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
};

// ─── Logout ──────────────────────────────────────────────────────

/**
 * Invalidate the user's refresh token.
 *
 * The access token remains valid until it expires (up to 15 min).
 * This is a known JWT limitation. The client clears it from memory.
 *
 * @param {string} userId — The authenticated user's ID
 */
export const logout = async (userId) => {
  await User.findByIdAndUpdate(userId, { refreshToken: null });
};

// ─── Get Current User ────────────────────────────────────────────

/**
 * Get the currently authenticated user's profile.
 *
 * Returns through Mongoose toJSON transform, so sensitive fields
 * (passwordHash, refreshToken, etc.) are automatically excluded.
 *
 * @param {string} userId — The authenticated user's ID
 * @returns {Promise<object>} User document (sanitized)
 */
export const getMe = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return user;
};

// ─── Forgot Password ────────────────────────────────────────────

/**
 * Generate a password reset token and send it via email.
 *
 * Why always return success even if email doesn't exist?
 * To prevent email enumeration. If we returned "Email not found",
 * attackers could discover which emails are registered.
 *
 * The reset token is:
 * - Generated as 32 random bytes (hex string)
 * - Hashed (SHA-256) before storing in DB
 * - Sent unhashed via email
 * - On reset, the incoming token is hashed and compared with the stored hash
 *
 * Why hash before storing?
 * If the database is breached, attackers can't use the stored hashes
 * to reset anyone's password. They'd need the original token from the email.
 *
 * @param {string} email — User's email address
 */
export const forgotPassword = async (email) => {
  const user = await User.findOne({ email });

  // Silently return if user doesn't exist — no error to prevent enumeration
  if (!user) {
    return;
  }

  // Generate reset token pair (plain + hashed)
  const { plainToken, hashedToken } = generateResetToken();

  // Store hashed token and expiry in user document
  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpire = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
  await user.save({ validateBeforeSave: false });

  // Build the reset URL pointing to the frontend
  const resetUrl = `${config.CLIENT_URL}/reset-password/${plainToken}`;

  // Send the email (fire-and-forget would hide errors, so we await)
  try {
    await sendPasswordResetEmail(user.email, resetUrl);
  } catch (error) {
    // If email fails, clear the reset token so the user can retry
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });

    throw new ApiError(500, 'Failed to send password reset email. Please try again later.');
  }
};

// ─── Reset Password ─────────────────────────────────────────────

/**
 * Reset the user's password using the token from the email link.
 *
 * Flow:
 * 1. Hash the incoming plain token
 * 2. Find user with matching hash AND non-expired token
 * 3. Set new password (pre-save hook will hash it)
 * 4. Clear reset fields + refresh token (force re-login everywhere)
 * 5. Save
 *
 * @param {string} token        — The plain reset token from the URL
 * @param {string} newPassword  — The new password
 */
export const resetPassword = async (token, newPassword) => {
  // 1. Hash the incoming token for comparison
  const hashedToken = hashToken(token);

  // 2. Find user with matching token that hasn't expired
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  }).select('+resetPasswordToken +resetPasswordExpire');

  if (!user) {
    throw new ApiError(400, 'Invalid or expired reset token. Please request a new one.');
  }

  // 3. Set the new password — pre-save hook will hash it
  user.passwordHash = newPassword;

  // 4. Clear reset fields and invalidate all sessions
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  user.refreshToken = null;

  // 5. Save — triggers the password hashing pre-save hook
  await user.save();
};
