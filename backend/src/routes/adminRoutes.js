const express = require('express');
const adminController = require('../controllers/adminController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate, authorize('admin'));

// ── Dashboard ─────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get full dashboard summary
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 */
router.get('/dashboard', adminController.dashboard);

// ── Legacy stats endpoints ────────────────────────────────────────────────────
router.get('/attendance', adminController.attendance);
router.get('/revenue', adminController.revenue);
router.get('/machines', adminController.machines);
router.get('/users/stats', adminController.users);
router.get('/crowd', adminController.crowd);

// ── User management ───────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List all users (paginated)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, suspended, inactive]
 *     responses:
 *       200:
 *         description: Paginated user list
 */
router.get('/users', adminController.listAllUsers);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Get a user by ID
 *     tags: [Admin]
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
 *         description: User details
 *       404:
 *         description: User not found
 */
router.get('/users/:id', adminController.getUserById);

/**
 * @swagger
 * /api/admin/users/{id}/status:
 *   patch:
 *     summary: Update user status (activate/suspend)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, suspended, inactive]
 *     responses:
 *       200:
 *         description: User status updated
 */
router.patch('/users/:id/status', adminController.updateUserStatus);

// ── Feedback ──────────────────────────────────────────────────────────────────
router.get('/feedback', adminController.listAllFeedback);

// ── Shop / Orders ─────────────────────────────────────────────────────────────
router.get('/orders', adminController.listAllOrders);

// ── Payments ──────────────────────────────────────────────────────────────────
router.get('/payments', adminController.listAllPayments);

// ── Subscriptions ─────────────────────────────────────────────────────────────
router.get('/subscriptions', adminController.listAllSubscriptions);

// ── InBody Scans ──────────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/admin/scans:
 *   get:
 *     summary: List all InBody scans (optionally filter by userId)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of scans
 */
router.get('/scans', adminController.listAllScans);

// ── Generated Plans ───────────────────────────────────────────────────────────
router.get('/plans', adminController.listAllGeneratedPlans);

// ── Full Attendance Log ───────────────────────────────────────────────────────
router.get('/attendance/log', adminController.listAllAttendance);

// ── AI Interactions Audit ─────────────────────────────────────────────────────
/**
 * @swagger
 * /api/admin/ai/interactions:
 *   get:
 *     summary: Get AI agent interaction audit log
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of AI interactions
 */
router.get('/ai/interactions', adminController.listAiInteractions);

module.exports = router;
