const express = require('express');
const workoutController = require('../controllers/workoutController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { workoutGenerateValidator, workoutProgressValidator } = require('../validators/workoutValidators');

const router = express.Router();

router.use(authenticate, authorize('user'));
router.post('/generate', validate(workoutGenerateValidator), workoutController.generate);
router.get('/current', workoutController.getCurrent);
router.get('/history', workoutController.getHistory);
router.put('/progress', validate(workoutProgressValidator), workoutController.updateProgress);

module.exports = router;
