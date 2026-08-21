const express = require('express');
const mealController = require('../controllers/mealController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { mealGenerateValidator } = require('../validators/mealValidators');

const router = express.Router();

router.use(authenticate, authorize('user'));
router.post('/generate', validate(mealGenerateValidator), mealController.generate);
router.get('/current', mealController.getCurrent);
router.get('/history', mealController.getHistory);

module.exports = router;
