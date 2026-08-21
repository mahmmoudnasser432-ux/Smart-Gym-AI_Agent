const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const workoutRoutes = require('./workoutRoutes');
const mealRoutes = require('./mealRoutes');
const machineRoutes = require('./machineRoutes');
const tokenRoutes = require('./tokenRoutes');
const qrRoutes = require('./qrRoutes');
const chatRoutes = require('./chatRoutes');
const adminRoutes = require('./adminRoutes');
const aiRoutes = require('./aiRoutes');
const featureRoutes = require('./featureRoutes');
const subscriptionRoutes = require('./subscriptionRoutes');
const shopRoutes = require('./shopRoutes');
const feedbackRoutes = require('./feedbackRoutes');
const coachRoutes = require('./coachRoutes');
const inboxRoutes = require('./inboxRoutes');
const planRoutes = require('./planRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/users', userRoutes);  // alias — Flutter uses /api/users

router.use('/workout', workoutRoutes);
router.use('/meal', mealRoutes);
router.use('/machine', machineRoutes); // alias
router.use('/machines', machineRoutes);
router.use('/tokens', tokenRoutes);
router.use('/qr', qrRoutes);
router.use('/attendance', qrRoutes);
router.use('/chat', chatRoutes);
router.use('/ai', aiRoutes);
router.use('/admin', adminRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/shop', shopRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/coaches', coachRoutes);
router.use('/inbox', inboxRoutes);
router.use('/plans', planRoutes);
router.use('/', featureRoutes);

module.exports = router;
