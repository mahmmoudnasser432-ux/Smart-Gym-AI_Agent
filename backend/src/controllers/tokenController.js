const tokenService = require('../services/tokenService');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');

exports.getBalance = asyncHandler(async (req, res) => {
    success(res, await tokenService.getBalance(req.user.userId));
});

exports.buy = asyncHandler(async (req, res) => {
    success(res, await tokenService.buyTokens(req.user.userId, req.body), 201);
});

exports.getHistory = asyncHandler(async (req, res) => {
    success(res, await tokenService.getHistory(req.user.userId));
});

exports.getTokenAnalytics = asyncHandler(async (req, res) => {
    success(res, await tokenService.getTokenAnalytics());
});
