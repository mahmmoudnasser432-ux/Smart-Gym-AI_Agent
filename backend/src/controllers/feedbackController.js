const feedbackService = require('../services/feedbackService');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');

exports.submit = asyncHandler(async (req, res) => {
    success(res, await feedbackService.submitFeedback(req.user.userId, req.body), 201);
});

exports.mine = asyncHandler(async (req, res) => {
    success(res, await feedbackService.getMyFeedback(req.user.userId));
});
