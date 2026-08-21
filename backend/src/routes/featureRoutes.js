const express = require('express');
const aiController = require('../controllers/aiController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const {
    generatePlanValidator,
    biologicalAgeValidator,
    progressAnalysisValidator,
    adaptPlanValidator,
    generateReportValidator
} = require('../validators/aiValidators');

const router = express.Router();

router.use(authenticate, authorize('user'));

router.post('/generate-plan', validate(generatePlanValidator), aiController.generatePlan);
router.post('/biological-age', validate(biologicalAgeValidator), aiController.biologicalAge);
router.post('/progress-insights', validate(progressAnalysisValidator), aiController.progressInsights);
router.post('/adapt-plan', validate(adaptPlanValidator), aiController.adaptPlan);
router.post('/export-pdf', validate(generateReportValidator), aiController.exportPdf);

module.exports = router;
