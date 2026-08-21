const inboxService = require('../services/inboxService');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');

// ── Admin endpoints ───────────────────────────────────────────────────────────

exports.getInboxUserList = asyncHandler(async (req, res) => {
    success(res, await inboxService.getInboxUserList());
});

exports.getInboxConversation = asyncHandler(async (req, res) => {
    success(res, await inboxService.getInboxConversation(Number(req.params.userId)));
});

exports.adminSendMessage = asyncHandler(async (req, res) => {
    const { content } = req.body;
    success(res, await inboxService.adminSendMessage(
        req.user.userId,
        Number(req.params.userId),
        content
    ), 201);
});

// ── User endpoints ────────────────────────────────────────────────────────────

exports.getUserInbox = asyncHandler(async (req, res) => {
    success(res, await inboxService.getUserInbox(req.user.userId));
});

exports.userReplyToAdmin = asyncHandler(async (req, res) => {
    const { content } = req.body;
    success(res, await inboxService.userReplyToAdmin(req.user.userId, content), 201);
});

exports.getUserUnreadCount = asyncHandler(async (req, res) => {
    success(res, await inboxService.getUserUnreadCount(req.user.userId));
});
