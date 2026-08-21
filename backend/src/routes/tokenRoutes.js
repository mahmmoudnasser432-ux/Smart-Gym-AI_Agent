const express = require('express');
const tokenController = require('../controllers/tokenController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { buyTokensValidator } = require('../validators/tokenValidators');

const router = express.Router();

router.use(authenticate);

// ── User Token Endpoints ──
router.get('/balance', authorize('user'), tokenController.getBalance);
router.post('/buy', authorize('user'), validate(buyTokensValidator), tokenController.buy);
router.get('/history', authorize('user'), tokenController.getHistory);

// ── Admin Token Analytics ──
router.get('/admin/analytics', authorize('admin'), tokenController.getTokenAnalytics);

module.exports = router;
