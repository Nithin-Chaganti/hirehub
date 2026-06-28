import { Router } from 'express';
import * as notificationController from '../controllers/notificationController.js';
import authMiddleware from '../middleware/authMiddleware.js';

/**
 * Notification Routes — /api/v1/notifications
 *
 * Route Summary:
 *
 * | Method | Path           | Auth     | Role      | Middleware    |
 * |--------|----------------|----------|-----------|--------------|
 * | GET    | /              | Bearer   | Any       | auth         |
 * | GET    | /unread-count  | Bearer   | Any       | auth         |  // NEW
 * | PATCH  | /read-all      | Bearer   | Any       | auth         |  // NEW
 * | PATCH  | /:id/read      | Bearer   | Any       | auth         |
 * | DELETE | /:id           | Bearer   | Any       | auth         |  // NEW
 * | DELETE | /              | Bearer   | Any       | auth         |  // NEW
 *
 * All endpoints are authenticated (both candidates and recruiters receive notifications).
 * No role restriction — both roles can access their own notifications.
 * No validation middleware (no request bodies).
 */

const router = Router();

// ─── Protected Routes (Any Authenticated User) ───────────────────────

// Get user's notifications
router.get('/', authMiddleware, notificationController.getNotifications);

// NEW: Unread count (badge)
router.get('/unread-count', authMiddleware, notificationController.getUnreadCount);

// NEW: Mark all as read
router.patch('/read-all', authMiddleware, notificationController.markAllAsRead);

// Mark notification as read
router.patch('/:id/read', authMiddleware, notificationController.markNotificationAsRead);

// NEW: Delete single notification
router.delete('/:id', authMiddleware, notificationController.deleteNotification);

// NEW: Delete all notifications
router.delete('/', authMiddleware, notificationController.deleteAllNotifications);

export default router;