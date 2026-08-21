const express = require('express');
const subscriptionController = require('../controllers/subscriptionController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const {
    createSubscriptionValidator,
    cancelSubscriptionValidator
} = require('../validators/subscriptionValidators');

const router = express.Router();

router.use(authenticate, authorize('user'));
router.get('/current', subscriptionController.current);
router.get('/history', subscriptionController.history);
router.post('/subscribe', validate(createSubscriptionValidator), subscriptionController.create);
router.post('/cancel', validate(cancelSubscriptionValidator), subscriptionController.cancel);

module.exports = router;
