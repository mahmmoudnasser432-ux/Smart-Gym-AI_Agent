const chatService = require('../services/chatService');
const aiService = require('../services/aiService');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');

exports.send = asyncHandler(async (req, res) => {
    success(res, await chatService.sendMessage(req.user, req.body), 201);
});

exports.sendToCoach = asyncHandler(async (req, res) => {
    success(res, await chatService.sendToCoach(req.user, req.body), 201);
});

exports.history = asyncHandler(async (req, res) => {
    const counterpartId = Number(req.query.userId || req.query.coachId);
    success(res, await chatService.getHistory(req.user, counterpartId));
});

exports.myHistory = asyncHandler(async (req, res) => {
    success(res, await chatService.getMyHistory(req.user));
});

exports.conversations = asyncHandler(async (req, res) => {
    success(res, await chatService.getConversations(req.user));
});

exports.aiReply = asyncHandler(async (req, res) => {
    if (req.user.role !== 'user') {
        return res.status(403).json({
            status: 'error',
            message: 'Only users can access AI chat'
        });
    }

    success(
        res,
        await aiService.gymChat(
            req.user.userId,
            req.body.message,
            req.body.history || req.body.chat_history || [],
            req.body.sessionId || req.body.session_id
        )
    );
});
