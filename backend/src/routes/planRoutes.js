const express = require('express');
const planController = require('../controllers/planController');
const aiController = require('../controllers/aiController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(authenticate, authorize('user'));

/**
 * GET /api/plans/latest
 * Retrieves the latest generated plan for the user
 */
router.get('/latest', aiController.latestPlan);

/**
 * POST /api/plans/generate
 * Generates an AI plan by sending scan data and user input to AI server
 */
router.post('/generate', planController.generatePlan);

/**
 * POST /api/plans/save
 * Saves the generated plan + linked InBody scan to DB
 */
router.post('/save', planController.savePlan);

/**
 * GET /api/plans/:planId/pdf
 * Downloads a PDF report of the saved plan
 */
router.get('/:planId/pdf', planController.downloadPdf);

module.exports = router;
