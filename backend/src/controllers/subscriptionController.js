const subscriptionService = require('../services/subscriptionService');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');

exports.current = asyncHandler(async (req, res) => {
    success(res, await subscriptionService.getCurrentSubscription(req.user.userId));
});

exports.history = asyncHandler(async (req, res) => {
    success(res, await subscriptionService.listSubscriptions(req.user.userId));
});

exports.create = asyncHandler(async (req, res) => {
    success(res, await subscriptionService.createSubscription(req.user.userId, req.body), 201);
});

exports.cancel = asyncHandler(async (req, res) => {
    success(res, await subscriptionService.cancelSubscription(req.user.userId, req.body.subscriptionId));
});
