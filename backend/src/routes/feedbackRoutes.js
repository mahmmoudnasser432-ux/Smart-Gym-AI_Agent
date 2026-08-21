const express = require('express');
const feedbackController = require('../controllers/feedbackController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { createFeedbackValidator } = require('../validators/feedbackValidators');

const router = express.Router();

router.use(authenticate, authorize('user'));
router.post('/', validate(createFeedbackValidator), feedbackController.submit);
router.get('/mine', feedbackController.mine);

module.exports = router;
