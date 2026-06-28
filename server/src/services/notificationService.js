import Notification from '../models/Notification.js';
import ApiError from '../utils/ApiError.js';

/**
 * Notification Service — Fire-and-Forget Pattern + Read/Write Operations
 *
 * Creates notifications as side effects of other operations.
 * Uses fire-and-forget pattern: we don't await notification creation
 * and suppress errors to prevent blocking the primary operation.
 *
 * Also handles reading, marking, and clearing notifications.
 *
 * Future enhancements:
 * - Add message queue (Redis/Bull) for reliable delivery
 * - Add retry logic for failed notifications
 * - Add notification preferences (opt-out)
 * - (TODO) Wrap createNotification in a queueNotification() helper
 *   so that swapping to a real queue later only changes one function.
 *
 * Phase 10 Improvements (complete):
 * - markNotificationAsRead uses findOneAndUpdate (single atomic query)
 * - Idempotent: only updates if currently unread, otherwise returns existing record
 * - New endpoints: unread count, mark all as read, delete single, delete all
 * - Pagination now returns hasNext / hasPrev for frontend convenience
 * - deleteAllNotifications returns deletedCount
 * - ObjectId validation is handled in routes (via validateObjectId middleware)
 *
 * Model requirements (to be set in models/Notification.js):
 * - type field MUST have an enum: ['new_application', 'application_status', 'job_closed']
 * - Indexes:
 *   notificationSchema.index({ recipient: 1, createdAt: -1 });
 *   notificationSchema.index({ recipient: 1, isRead: 1 });
 */

/**
 * Create a notification for a user.
 *
 * This function is designed to be called without await.
 * Errors are suppressed to prevent notification failures from
 * blocking the primary operation (e.g., applying to a job).
 *
 * @param {string} recipient - The user ID who should receive the notification
 * @param {string} type - Notification type (new_application, application_status, job_closed)
 * @param {string} title - Short notification title
 * @param {string} message - Notification body
 * @param {string} [relatedJob] - Optional related job ID
 * @param {string} [relatedApplication] - Optional related application ID
 */
export const createNotification = async (
  recipient,
  type,
  title,
  message,
  relatedJob = null,
  relatedApplication = null
) => {
  try {
    await Notification.create({
      recipient,
      type,
      title,
      message,
      relatedJob,
      relatedApplication,
    });
  } catch (error) {
    // Silently ignore notification errors
    // The primary operation should not fail due to notification issues
    // In production, log this to an error monitoring service
    console.error('Notification creation failed:', error.message);
  }
};

// ─── Get Notifications ─────────────────────────────────────────────

/**
 * Get notifications for the current user.
 *
 * Populates relatedJob (title only) and relatedApplication (id only)
 * to keep responses lightweight. Supports pagination and optional
 * unreadOnly filter. Pagination metadata now includes hasNext/hasPrev.
 *
 * @param {string} userId - The authenticated user's ID
 * @param {object} queryParams - Express req.query object
 * @returns {Promise<{ notifications: object[], pagination: object }>}
 */
export const getNotifications = async (userId, queryParams) => {
  const { page = 1, limit = 20, unreadOnly = false } = queryParams;

  // Pagination
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  // Build filter
  const filter = { recipient: userId };
  if (unreadOnly === 'true' || unreadOnly === true) {
    filter.isRead = false;
  }

  // Execute query
  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('relatedJob', 'title')
      .populate('relatedApplication', '_id')
      .lean(),
    Notification.countDocuments(filter),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limitNum));

  return {
    notifications,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: totalPages,
      hasNext: pageNum < totalPages,   // NEW
      hasPrev: pageNum > 1,           // NEW
    },
  };
};

// ─── Mark Notification as Read ───────────────────────────────────────

/**
 * Mark a single notification as read.
 *
 * Uses findOneAndUpdate to combine ownership check + update in one atomic operation.
 * If the notification is already read, we simply return the existing document
 * without triggering a write (idempotent).
 *
 * @param {string} userId - The authenticated user's ID
 * @param {string} notificationId - The notification's document ID (validated as ObjectId by route)
 * @returns {Promise<object>} Updated notification document
 */
export const markNotificationAsRead = async (userId, notificationId) => {
  // Attempt to update only unread notifications belonging to this user
  let notification = await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      recipient: userId,
      isRead: false,
    },
    { $set: { isRead: true } },
    { new: true }
  );

  // If the update found nothing, check whether the notification exists at all
  if (!notification) {
    // It might be already read, or it might not exist / not belong to the user
    const existing = await Notification.findOne({ _id: notificationId, recipient: userId });
    if (existing) {
      // Already read – return as-is (no write needed)
      return existing;
    }
    throw new ApiError(404, 'Notification not found');
  }

  return notification;
};

// ─── Unread Count ────────────────────────────────────────────────────

/**
 * Get the number of unread notifications for the current user.
 *
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<{ count: number }>}
 */
export const getUnreadCount = async (userId) => {
  const count = await Notification.countDocuments({ recipient: userId, isRead: false });
  return { count };
};

// ─── Mark All as Read ─────────────────────────────────────────────────

/**
 * Mark all notifications as read for the current user.
 *
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<{ modifiedCount: number }>}
 */
export const markAllAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true } }
  );
  return { modifiedCount: result.modifiedCount };
};

// ─── Delete Single Notification ──────────────────────────────────────

/**
 * Delete a single notification.
 *
 * @param {string} userId - The authenticated user's ID
 * @param {string} notificationId - The notification's document ID (validated as ObjectId by route)
 */
export const deleteNotification = async (userId, notificationId) => {
  const result = await Notification.findOneAndDelete({
    _id: notificationId,
    recipient: userId,
  });

  if (!result) {
    throw new ApiError(404, 'Notification not found');
  }
  // No return needed; controller sends success message
};

// ─── Delete All Notifications ─────────────────────────────────────────

/**
 * Delete all notifications for the current user.
 *
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<{ deletedCount: number }>}
 */
export const deleteAllNotifications = async (userId) => {
  const result = await Notification.deleteMany({ recipient: userId });
  return { deletedCount: result.deletedCount };   // NEW: return count
};