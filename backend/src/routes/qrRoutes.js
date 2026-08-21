const express = require('express');
const qrController = require('../controllers/qrController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(authenticate, authorize('user'));
router.post('/checkin', qrController.checkIn);
router.post('/checkout', qrController.checkOut);
router.get('/history', qrController.history);

module.exports = router;
