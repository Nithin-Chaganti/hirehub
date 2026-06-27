import Notification from '../models/Notification.js';

/**
 * Notification Service — Fire-and-Forget Pattern
 *
 * Creates notifications as side effects of other operations.
 * Uses fire-and-forget pattern: we don't await notification creation
 * and suppress errors to prevent blocking the primary operation.
 *
 * Future enhancements:
 * - Add message queue (Redis/Bull) for reliable delivery
 * - Add retry logic for failed notifications
 * - Add notification preferences (opt-out)
 * - (TODO) Wrap createNotification in a queueNotification() helper
 *   so that swapping to a real queue later only changes one function.
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