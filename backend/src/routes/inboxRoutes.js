const express = require('express');
const inboxController = require('../controllers/inboxController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
router.use(authenticate);

// ── Admin routes ─────────────────────────────────────────────────────────────

// List all users with last message summary (for Admin's chat list)
router.get('/users', authorize('admin'), inboxController.getInboxUserList);

// Get full conversation with a specific user
router.get('/conversation/:userId', authorize('admin'), inboxController.getInboxConversation);

// Admin sends a message to a user
router.post('/send/:userId', authorize('admin'), inboxController.adminSendMessage);

// ── User routes ───────────────────────────────────────────────────────────────

// User views their inbox (messages from admin)
router.get('/my', authorize('user'), inboxController.getUserInbox);

// User replies to admin
router.post('/reply', authorize('user'), inboxController.userReplyToAdmin);

// User checks unread count (for badge/notification)
router.get('/unread', authorize('user'), inboxController.getUserUnreadCount);

module.exports = router;
