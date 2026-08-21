const adminService = require('../services/adminService');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');

// ── Existing stats endpoints ───────────────────────────────────────────────────
exports.attendance = asyncHandler(async (req, res) => {
    success(res, await adminService.getAttendanceStats());
});

exports.revenue = asyncHandler(async (req, res) => {
    success(res, await adminService.getRevenueStats());
});

exports.machines = asyncHandler(async (req, res) => {
    success(res, await adminService.getMachineStats());
});

exports.users = asyncHandler(async (req, res) => {
    success(res, await adminService.getUserStats());
});

exports.crowd = asyncHandler(async (req, res) => {
    success(res, await adminService.getCrowdStats());
});

// ── NEW: Dashboard summary ────────────────────────────────────────────────────
exports.dashboard = asyncHandler(async (req, res) => {
    success(res, await adminService.getDashboardSummary());
});

// ── NEW: User management ──────────────────────────────────────────────────────
exports.listAllUsers = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const { status } = req.query;
    success(res, await adminService.listAllUsers({ page, limit, status }));
});

exports.getUserById = asyncHandler(async (req, res) => {
    success(res, await adminService.getUserById(Number(req.params.id)));
});

exports.updateUserStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    success(res, await adminService.updateUserStatus(Number(req.params.id), status));
});

// ── NEW: Feedback management ──────────────────────────────────────────────────
exports.listAllFeedback = asyncHandler(async (req, res) => {
    success(res, await adminService.listAllFeedback());
});

// ── NEW: Orders management ────────────────────────────────────────────────────
exports.listAllOrders = asyncHandler(async (req, res) => {
    success(res, await adminService.listAllOrders());
});

// ── NEW: Payments management ──────────────────────────────────────────────────
exports.listAllPayments = asyncHandler(async (req, res) => {
    success(res, await adminService.listAllPayments());
});

// ── NEW: Subscriptions management ────────────────────────────────────────────
exports.listAllSubscriptions = asyncHandler(async (req, res) => {
    success(res, await adminService.listAllSubscriptions());
});

// ── NEW: InBody scans management ──────────────────────────────────────────────
exports.listAllScans = asyncHandler(async (req, res) => {
    const userId = req.query.userId ? Number(req.query.userId) : null;
    success(res, await adminService.listAllScans(userId));
});

// ── NEW: Generated plans management ──────────────────────────────────────────
exports.listAllGeneratedPlans = asyncHandler(async (req, res) => {
    success(res, await adminService.listAllGeneratedPlans());
});

// ── NEW: Full attendance log ──────────────────────────────────────────────────
exports.listAllAttendance = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    success(res, await adminService.listAllAttendance({ page, limit }));
});

// ── NEW: AI Interactions audit log ───────────────────────────────────────────
exports.listAiInteractions = asyncHandler(async (req, res) => {
    const userId = req.query.userId ? Number(req.query.userId) : null;
    const { type } = req.query;
    const limit = parseInt(req.query.limit) || 50;
    success(res, await adminService.listAiInteractions({ userId, type, limit }));
});
