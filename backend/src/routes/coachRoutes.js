const express = require('express');
const coachController = require('../controllers/coachController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { upload, handleUploadError } = require('../middleware/uploadMiddleware');

const router = express.Router();

// ── Public / Authenticated read ────────────────────────────────────────────────
/**
 * @swagger
 * /api/coaches:
 *   get:
 *     summary: List all coaches
 *     tags: [Coaches]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of coaches
 */
router.get('/', authenticate, coachController.listCoaches);

/**
 * @swagger
 * /api/coaches/{id}:
 *   get:
 *     summary: Get coach by ID
 *     tags: [Coaches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Coach object
 *       404:
 *         description: Coach not found
 */
router.get('/:id', authenticate, coachController.getCoach);

// ── Admin only write operations ────────────────────────────────────────────────
/**
 * @swagger
 * /api/coaches:
 *   post:
 *     summary: Create a new coach (admin only)
 *     tags: [Coaches]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               phone:
 *                 type: string
 *               specialty:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created coach
 *       409:
 *         description: Email already used
 */
router.post('/', authenticate, authorize('admin'), upload.single('photo'), handleUploadError, coachController.createCoach);

/**
 * @swagger
 * /api/coaches/{id}:
 *   put:
 *     summary: Update a coach (admin only)
 *     tags: [Coaches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               phone:
 *                 type: string
 *               specialty:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated coach
 */
router.put('/:id', authenticate, authorize('admin'), coachController.updateCoach);

/**
 * @swagger
 * /api/coaches/{id}:
 *   delete:
 *     summary: Delete a coach (admin only)
 *     tags: [Coaches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete('/:id', authenticate, authorize('admin'), coachController.deleteCoach);

/**
 * @swagger
 * /api/coaches/{id}/messages:
 *   get:
 *     summary: Get all messages sent by a coach (admin only)
 *     tags: [Coaches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of messages
 */
router.get('/:id/messages', authenticate, authorize('admin'), coachController.getCoachMessages);

// ── Rating ────────────────────────────────────────────────────────────────────

// User submits a rating for a coach (user only, once per 30 days)
router.post('/:id/rate', authenticate, authorize('user'), coachController.rateCoach);

// User checks if they already rated this coach
router.get('/:id/my-rating', authenticate, authorize('user'), coachController.getMyRatingForCoach);

// Admin views all ratings for a coach
router.get('/:id/ratings', authenticate, authorize('admin'), coachController.getCoachRatings);

// ── Tracking Customers (Coach & Admin) ───────────────────────────────────────

// List all customers for tracking
router.get('/customers/list', authenticate, authorize('coach', 'admin'), coachController.getTrackingCustomers);

// View customer attendance
router.get('/customers/:userId/attendance', authenticate, authorize('coach', 'admin'), coachController.getCustomerAttendance);

// View customer progress (InBody)
router.get('/customers/:userId/progress', authenticate, authorize('coach', 'admin'), coachController.getCustomerProgress);

// View customer activity (inactive days)
router.get('/customers/:userId/activity', authenticate, authorize('coach', 'admin'), coachController.getCustomerActivity);

// Send activity alert to customer
router.post('/customers/:userId/alert', authenticate, authorize('coach', 'admin'), coachController.sendActivityAlert);

module.exports = router;
