const mealService = require('../services/mealService');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');

exports.generate = asyncHandler(async (req, res) => {
    success(res, await mealService.generate(req.user.userId, req.body), 201);
});

exports.getCurrent = asyncHandler(async (req, res) => {
    success(res, await mealService.getCurrent(req.user.userId));
});

exports.getHistory = asyncHandler(async (req, res) => {
    success(res, await mealService.getHistory(req.user.userId));
});
