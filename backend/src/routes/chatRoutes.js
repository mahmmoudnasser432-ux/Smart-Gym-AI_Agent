const express = require('express');
const chatController = require('../controllers/chatController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { sendChatValidator, chatHistoryValidator, aiChatValidator, sendUserChatValidator } = require('../validators/chatValidators');

const router = express.Router();

router.use(authenticate);
router.post('/', authorize('user'), validate(aiChatValidator), chatController.aiReply);
router.post('/send', authorize('coach', 'admin'), validate(sendChatValidator), chatController.send);
router.post('/user-send', authorize('user'), validate(sendUserChatValidator), chatController.sendToCoach);
router.get('/my-history', authorize('user'), chatController.myHistory);
router.get('/user-history', authorize('user'), chatController.myHistory);
router.get('/history', authorize('user', 'coach', 'admin'), validate(chatHistoryValidator), chatController.history);
router.get('/conversations', authorize('user', 'coach', 'admin'), chatController.conversations);
router.post('/ai', authorize('user'), validate(aiChatValidator), chatController.aiReply);

module.exports = router;
