const express = require('express');
const userController = require('../controllers/userController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { upload, handleUploadError } = require('../middleware/uploadMiddleware');

const { updateProfileValidator, bodyDataValidator } = require('../validators/userValidators');
const normalizeInbodyPayload = require('../middleware/normalizeInbody');

const router = express.Router();

router.use(authenticate, authorize('user'));
router.get('/profile', userController.getProfile);
router.put('/update-profile', validate(updateProfileValidator), userController.updateProfile);
router.put('/body-data', normalizeInbodyPayload, validate(bodyDataValidator), userController.updateBodyData);
router.get('/progress', userController.getProgress);

/**
 * POST /api/users/profile/picture
 * Content-Type: multipart/form-data
 * Field name: any
 * Saves the image permanently and returns the public URL.
 */
router.post('/profile/picture', upload.any(), handleUploadError, userController.uploadProfilePicture);

/**
 * GET /api/users/:userId/inbody
 * Returns the list of InBody scans for the user.
 */
router.get('/:userId/inbody', userController.getInbodyScans);

/**
 * GET /api/users/:userId/inbody/:scanId
 * Returns the specific, read-only InBody scan details.
 */
router.get('/:userId/inbody/:scanId', userController.getInbodyScanById);

module.exports = router;

