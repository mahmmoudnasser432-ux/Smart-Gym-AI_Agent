const machineService = require('../services/machineService');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');

// ── User & shared endpoints ────────────────────────────────────────────────────
exports.listMachines = asyncHandler(async (req, res) => {
    success(res, await machineService.listMachines());
});

exports.listAvailable = asyncHandler(async (req, res) => {
    success(res, await machineService.listAvailableMachines());
});

exports.bookedTimes = asyncHandler(async (req, res) => {
    success(res, await machineService.getBookedTimes(Number(req.params.id), req.query.date));
});

exports.book = asyncHandler(async (req, res) => {
    success(res, await machineService.bookMachine(req.user.userId, req.body), 201);
});

exports.cancel = asyncHandler(async (req, res) => {
    success(res, await machineService.cancelBooking(req.user.userId, req.body.bookingId));
});

exports.history = asyncHandler(async (req, res) => {
    success(res, await machineService.getBookingHistory(req.user.userId));
});

// ── Admin CRUD endpoints ───────────────────────────────────────────────────────
exports.createMachine = asyncHandler(async (req, res) => {
    success(res, await machineService.createMachine(req.body), 201);
});

exports.updateMachine = asyncHandler(async (req, res) => {
    success(res, await machineService.updateMachine(Number(req.params.id), req.body));
});

exports.deleteMachine = asyncHandler(async (req, res) => {
    success(res, await machineService.deleteMachine(Number(req.params.id)));
});

exports.addCrowdSnapshot = asyncHandler(async (req, res) => {
    success(res, await machineService.addCrowdSnapshot(req.body), 201);
});

exports.listAllBookings = asyncHandler(async (req, res) => {
    success(res, await machineService.listAllBookings());
});
