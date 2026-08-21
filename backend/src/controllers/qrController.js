const qrService = require('../services/qrService');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');

exports.checkIn = asyncHandler(async (req, res) => {
    success(res, await qrService.checkIn(req.user.userId, req.body.machineId), 201);
});

exports.checkOut = asyncHandler(async (req, res) => {
    success(res, await qrService.checkOut(req.user.userId));
});

exports.history = asyncHandler(async (req, res) => {
    success(res, await qrService.getHistory(req.user.userId));
});
