const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');

exports.register = asyncHandler(async (req, res) => {
    const data = await authService.register(req.body);
    success(res, data, 201);
});

exports.login = asyncHandler(async (req, res) => {
    const data = await authService.login(req.body);
    success(res, data);
});

exports.profile = asyncHandler(async (req, res) => {
    const data = await authService.getProfile(req.user);
    success(res, data);
});

exports.refreshToken = asyncHandler(async (req, res) => {
    const data = await authService.refreshToken(req.body);
    success(res, data);
});

exports.forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const data = await authService.forgotPassword(email);
    success(res, data);
});

exports.verifyResetCode = asyncHandler(async (req, res) => {
    const { email, code } = req.body;
    const data = await authService.verifyResetCode(email, code);
    success(res, data);
});

exports.resetPassword = asyncHandler(async (req, res) => {
    const { email, code, newPassword } = req.body;
    const data = await authService.resetPassword(email, code, newPassword);
    success(res, data);
});

