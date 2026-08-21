const workoutService = require('../services/workoutService');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');

exports.generate = asyncHandler(async (req, res) => {
    success(res, await workoutService.generate(req.user.userId, req.body), 201);
});

exports.getCurrent = asyncHandler(async (req, res) => {
    success(res, await workoutService.getCurrent(req.user.userId));
});

exports.getHistory = asyncHandler(async (req, res) => {
    success(res, await workoutService.getHistory(req.user.userId));
});

exports.updateProgress = asyncHandler(async (req, res) => {
    success(res, await workoutService.updateProgress(req.user.userId, req.body));
});
