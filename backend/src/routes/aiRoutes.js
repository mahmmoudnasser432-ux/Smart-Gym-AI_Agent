const express = require('express');
const aiController = require('../controllers/aiController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const ApiError = require('../utils/apiError');
const aiService = require('../services/aiService');
const {
    generatePlanValidator,
    aiChatValidator,
    biologicalAgeValidator,
    progressAnalysisValidator,
    adaptPlanValidator,
    generateReportValidator,
    aiChatHistoryValidator,
    generatedPlanIdValidator,
    publicInbodyLookupValidator
} = require('../validators/aiValidators');
const { workoutGenerateValidator } = require('../validators/workoutValidators');
const { bodyDataValidator } = require('../validators/userValidators');
const userController = require('../controllers/userController');
const normalizeInbodyPayload = require('../middleware/normalizeInbody');

const router = express.Router();

// ─── Internal endpoint: AI Agent can save plan without JWT ─────────
// Protected by INTERNAL_SECRET header (machine-to-machine auth)
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'smartgym-internal-2024';

const verifyInternalSecret = (req, res, next) => {
    const secret = req.headers['x-internal-secret'];
    if (!secret || secret !== INTERNAL_SECRET) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized: invalid internal secret' });
    }
    next();
};

/**
 * POST /api/ai/internal/save-plan
 * Called by the AI Agent to persist a generated plan for a user.
 * Body: { user_id, plan_data: {...}, inbody_data: {...} }
 * Header: x-internal-secret: smartgym-internal-2024
 */
router.post('/internal/save-plan', verifyInternalSecret, asyncHandler(async (req, res) => {
    const { user_id, plan_data = {}, inbody_data = {} } = req.body;
    if (!user_id) {
        return res.status(400).json({ status: 'error', message: 'user_id is required' });
    }

    const savedPlan = await aiService.saveGeneratedPlanFromAgent(Number(user_id), req.body);
    success(res, savedPlan, 201);
}));

router.get('/public/inbody/latest', validate(publicInbodyLookupValidator), aiController.publicLatestScan);

router.use(authenticate, authorize('user'));

router.get('/context', aiController.getContext);
router.post('/plan', validate(workoutGenerateValidator), aiController.generatePlans);

router.post('/generate-plan', validate(generatePlanValidator), aiController.generatePlan);
router.get('/plans/latest', aiController.latestPlan);
router.get('/plans/history', aiController.planHistory);
router.get('/plans/:planId', validate(generatedPlanIdValidator), aiController.planById);

router.post('/chat', validate(aiChatValidator), aiController.gymChat);
router.get('/chat/history', validate(aiChatHistoryValidator), aiController.chatHistory);
router.get('/chat/sessions', aiController.chatSessions);

router.get('/scans/latest', aiController.latestScan);
router.get('/scans/history', aiController.scanHistory);
router.post('/scans/save', normalizeInbodyPayload, validate(bodyDataValidator), userController.updateBodyData);


router.post('/biological-age', validate(biologicalAgeValidator), aiController.biologicalAge);
router.post('/progress-analysis', validate(progressAnalysisValidator), aiController.progressAnalysis);
router.post('/progress-insights', validate(progressAnalysisValidator), aiController.progressInsights);
router.post('/adapt-plan', validate(adaptPlanValidator), aiController.adaptPlan);
router.post('/generate-report', validate(generateReportValidator), aiController.generateReport);
router.post('/export-pdf', validate(generateReportValidator), aiController.exportPdf);

module.exports = router;
