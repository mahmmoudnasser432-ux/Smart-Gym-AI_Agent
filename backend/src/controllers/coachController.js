const coachService = require('../services/coachService');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');

exports.listCoaches = asyncHandler(async (req, res) => {
    success(res, await coachService.listCoaches());
});

exports.getCoach = asyncHandler(async (req, res) => {
    success(res, await coachService.getCoachById(Number(req.params.id)));
});

exports.createCoach = asyncHandler(async (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const profile_picture_url = req.file
        ? `${baseUrl}/uploads/profiles/${req.file.filename}`
        : null;
    success(res, await coachService.createCoach({ ...req.body, profile_picture_url }), 201);
});

exports.updateCoach = asyncHandler(async (req, res) => {
    success(res, await coachService.updateCoach(Number(req.params.id), req.body));
});

exports.deleteCoach = asyncHandler(async (req, res) => {
    success(res, await coachService.deleteCoach(Number(req.params.id)));
});

exports.getCoachMessages = asyncHandler(async (req, res) => {
    success(res, await coachService.getCoachMessages(Number(req.params.id)));
});

// ── Rating ────────────────────────────────────────────────────────────────────

exports.rateCoach = asyncHandler(async (req, res) => {
    success(res, await coachService.rateCoach(req.user.userId, Number(req.params.id), req.body), 201);
});

exports.getCoachRatings = asyncHandler(async (req, res) => {
    success(res, await coachService.getCoachRatings(Number(req.params.id)));
});

exports.getMyRatingForCoach = asyncHandler(async (req, res) => {
    success(res, await coachService.getMyRatingForCoach(req.user.userId, Number(req.params.id)));
});


// ── Tracking Customers ────────────────────────────────────────────────────────

exports.getTrackingCustomers = asyncHandler(async (req, res) => {
    success(res, await coachService.getTrackingCustomers(req.user.userId));
});

exports.getCustomerAttendance = asyncHandler(async (req, res) => {
    success(res, await coachService.getCustomerAttendance(Number(req.params.userId)));
});

exports.getCustomerProgress = asyncHandler(async (req, res) => {
    success(res, await coachService.getCustomerProgress(Number(req.params.userId)));
});

exports.getCustomerActivity = asyncHandler(async (req, res) => {
    success(res, await coachService.getCustomerActivity(Number(req.params.userId)));
});

exports.sendActivityAlert = asyncHandler(async (req, res) => {
    success(res, await coachService.sendActivityAlert(req.user.userId, Number(req.params.userId)), 201);
});
