import * as notificationService from '../services/notificationService.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';

/**
 * Notification Controller — HTTP Request/Response Handlers
 *
 * Thin layer that parses requests, delegates to notificationService,
 * and formats responses. No business logic here.
 *
 * Notable patterns:
 * - getNotifications returns a pagination object alongside the data
 * - New endpoints: unread count, mark all as read, delete single, delete all
 * - No request body validation needed (no request bodies)
 */

// ─── Get Notifications ─────────────────────────────────────────────

/**
 * GET /api/v1/notifications
 *
 * Returns the authenticated user's notifications.
 * Supports pagination and optional unreadOnly filter.
 */
export const getNotifications = asyncHandler(async (req, res) => {
  const result = await notificationService.getNotifications(req.user._id, req.query);

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        result.notifications,
        'Notifications fetched successfully',
        result.pagination
      )
    );
});

// ─── Mark Notification as Read ───────────────────────────────────────

/**
 * PATCH /api/v1/notifications/:id/read
 *
 * Marks a notification as read.
 */
export const markNotificationAsRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markNotificationAsRead(
    req.user._id,
    req.params.id
  );

  res
    .status(200)
    .json(new ApiResponse(200, notification, 'Notification marked as read'));
});

// ─── Unread Count ─────────────────────────────────────────────────────

/**
 * GET /api/v1/notifications/unread-count
 *
 * Returns the number of unread notifications for the badge.
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const result = await notificationService.getUnreadCount(req.user._id);

  res
    .status(200)
    .json(new ApiResponse(200, result, 'Unread count fetched successfully'));
});

// ─── Mark All as Read ──────────────────────────────────────────────────

/**
 * PATCH /api/v1/notifications/read-all
 *
 * Marks all notifications as read for the current user.
 */
export const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllAsRead(req.user._id);

  res
    .status(200)
    .json(new ApiResponse(200, result, 'All notifications marked as read'));
});

// ─── Delete Single Notification ───────────────────────────────────────

/**
 * DELETE /api/v1/notifications/:id
 *
 * Deletes a single notification.
 */
export const deleteNotification = asyncHandler(async (req, res) => {
  await notificationService.deleteNotification(req.user._id, req.params.id);

  res
    .status(200)
    .json(new ApiResponse(200, null, 'Notification deleted successfully'));
});

// ─── Delete All Notifications ──────────────────────────────────────────

/**
 * DELETE /api/v1/notifications
 *
 * Deletes all notifications for the current user.
 */
export const deleteAllNotifications = asyncHandler(async (req, res) => {
  const result = await notificationService.deleteAllNotifications(req.user._id);

  res
    .status(200)
    .json(new ApiResponse(200, result, 'All notifications deleted successfully'));
});