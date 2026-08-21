const userService = require('../services/userService');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');

exports.getProfile = asyncHandler(async (req, res) => {
    success(res, await userService.getProfile(req.user.userId));
});

exports.updateProfile = asyncHandler(async (req, res) => {
    success(res, await userService.updateProfile(req.user.userId, req.body));
});

exports.updateBodyData = asyncHandler(async (req, res) => {
    success(res, await userService.updateBodyData(req.user.userId, req.body));
});

exports.getProgress = asyncHandler(async (req, res) => {
    success(res, await userService.getProgress(req.user.userId));
});

exports.uploadProfilePicture = asyncHandler(async (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const file = (req.files && req.files.length > 0) ? req.files[0] : req.file;
    const data = await userService.uploadProfilePicture(req.user.userId, file, req.body, baseUrl);
    success(res, data);
});

exports.getInbodyScans = asyncHandler(async (req, res) => {
    // Allows user to view their own, or admin to view any
    const targetUserId = req.params.userId === 'me' ? req.user.userId : Number(req.params.userId);
    if (targetUserId !== req.user.userId && req.user.role !== 'admin') {
        return res.status(403).json({ status: 'error', message: 'Forbidden' });
    }
    success(res, await userService.listScans(targetUserId));
});

exports.getInbodyScanById = asyncHandler(async (req, res) => {
    const targetUserId = req.params.userId === 'me' ? req.user.userId : Number(req.params.userId);
    if (targetUserId !== req.user.userId && req.user.role !== 'admin') {
        return res.status(403).json({ status: 'error', message: 'Forbidden' });
    }
    success(res, await userService.getScanById(targetUserId, req.params.scanId));
});
