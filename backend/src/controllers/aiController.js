const aiService = require('../services/aiService');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');

exports.getContext = asyncHandler(async (req, res) => {
    success(res, await aiService.getContext(req.user.userId));
});

exports.publicLatestScan = asyncHandler(async (req, res) => {
    success(res, await aiService.getPublicLatestScan({
        userId: req.query.userId,
        email: req.query.email
    }));
});

exports.generatePlans = asyncHandler(async (req, res) => {
    success(res, await aiService.generatePlans(req.user.userId, req.body), 201);
});

exports.chat = asyncHandler(async (req, res) => {
    success(res, await aiService.chat(req.user.userId, req.body.message, req.body.sessionId));
});

exports.generatePlan = asyncHandler(async (req, res) => {
    success(res, await aiService.generatePlan(req.user.userId, req.body), 201);
});

exports.gymChat = asyncHandler(async (req, res) => {
    const { message, history, sessionId, session_id: sessionIdSnake } = req.body;
    success(res, await aiService.gymChat(req.user.userId, message, history || [], sessionId || sessionIdSnake));
});

exports.biologicalAge = asyncHandler(async (req, res) => {
    success(res, await aiService.biologicalAge(req.body));
});

exports.progressAnalysis = asyncHandler(async (req, res) => {
    success(res, await aiService.progressAnalysis(req.body));
});

exports.progressInsights = asyncHandler(async (req, res) => {
    success(res, await aiService.progressAnalysis(req.body));
});

exports.adaptPlan = asyncHandler(async (req, res) => {
    success(res, await aiService.adaptPlan(req.user.userId, req.body));
});

exports.latestScan = asyncHandler(async (req, res) => {
    success(res, await aiService.getLatestScan(req.user.userId));
});

exports.scanHistory = asyncHandler(async (req, res) => {
    success(res, await aiService.getScanHistory(req.user.userId));
});

exports.latestPlan = asyncHandler(async (req, res) => {
    success(res, await aiService.getLatestGeneratedPlan(req.user.userId));
});

exports.planHistory = asyncHandler(async (req, res) => {
    success(res, await aiService.getGeneratedPlanHistory(req.user.userId));
});

exports.planById = asyncHandler(async (req, res) => {
    success(res, await aiService.getGeneratedPlanById(req.user.userId, req.params.planId));
});

exports.chatHistory = asyncHandler(async (req, res) => {
    success(res, await aiService.getChatHistory(req.user.userId, req.query.sessionId || req.query.session_id));
});

exports.chatSessions = asyncHandler(async (req, res) => {
    success(res, await aiService.getChatSessions(req.user.userId));
});

exports.generateReport = asyncHandler(async (req, res) => {
    const pdfBuffer = await aiService.exportPdf(req.user.userId, req.body);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="smartgym-report-${req.body.plan_id || req.body.planId || 'custom'}.pdf"`);
    res.send(pdfBuffer);
});

exports.exportPdf = asyncHandler(async (req, res) => {
    const pdfBuffer = await aiService.exportPdf(req.user.userId, req.body);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="smartgym-report-${req.body.plan_id || req.body.planId || 'custom'}.pdf"`);
    res.send(pdfBuffer);
});
