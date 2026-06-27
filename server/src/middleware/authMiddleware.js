import User from '../models/User.js';
import { verifyAccessToken } from '../utils/tokenUtils.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Auth Middleware — JWT Access Token Verification
 *
 * Verifies the JWT access token from the Authorization header,
 * confirms the user still exists, and attaches the user document
 * to `req.user` for downstream middleware and controllers.
 *
 * Flow:
 * 1. Extract token from "Authorization: Bearer <token>" header
 * 2. Verify token signature and expiry via verifyAccessToken()
 * 3. Look up the user — account might have been deleted since token was issued
 * 4. Attach user to req.user
 *
 * Why check if user still exists?
 * A token could be valid (not expired, correct signature) but the user
 * account was deleted by an admin. Without this check, a deleted user
 * could still access the API for up to 15 minutes (token expiry window).
 *
 * Why not catch JWT errors here?
 * verifyAccessToken() throws JsonWebTokenError or TokenExpiredError on
 * failure. Our errorMiddleware already handles both, returning proper
 * 401 responses. No need to duplicate that handling here.
 *
 * Usage:
 *   import authMiddleware from '../middleware/authMiddleware.js';
 *   router.get('/me', authMiddleware, authController.getMe);
 */
const authMiddleware = asyncHandler(async (req, res, next) => {
  // 1. Extract token from Authorization header using regex
  //    Matches exactly "Bearer <token>" — rejects malformed headers like
  //    "Bearer " (no token), "Bearer\t<token>" (tab), or "BearerXYZ"
  const match = req.headers.authorization?.match(/^Bearer\s+(\S+)$/);

  if (!match) {
    throw new ApiError(401, 'Access token required');
  }

  const token = match[1];

  // 2. Verify token (throws JsonWebTokenError or TokenExpiredError on failure)
  const decoded = verifyAccessToken(token);

  // 3. Check if user still exists
  const user = await User.findById(decoded.userId);

  if (!user) {
    throw new ApiError(401, 'User no longer exists');
  }

  // 4. Reject deactivated users even if their token is valid
  if (!user.isActive) {
    throw new ApiError(403, 'Account suspended. Please contact support.');
  }

  // 5. Attach user to request for downstream use
  req.user = user;
  next();
});

export default authMiddleware;
