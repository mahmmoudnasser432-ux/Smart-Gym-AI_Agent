const express = require('express');
const authController = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/security');
const { registerValidator, loginValidator } = require('../validators/authValidators');

const router = express.Router();


router.use(authLimiter);

router.post('/register', validate(registerValidator), authController.register);
router.post('/login', validate(loginValidator), authController.login);

/**
 * POST /api/auth/refresh
 * Body: { refresh_token: "..." }
 * Returns a new access token + refresh token (no password needed)
 */
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/forgotPassword', authController.forgotPassword);
router.post('/forgotPasswords', authController.forgotPassword);

router.post('/verify-reset-code', authController.verifyResetCode);
router.post('/verifyResetCode', authController.verifyResetCode);

router.post('/reset-password', authController.resetPassword);
router.post('/resetPassword', authController.resetPassword);

router.get('/profile', authenticate, authController.profile);

module.exports = router;

