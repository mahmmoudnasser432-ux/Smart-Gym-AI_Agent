const { isPositiveNumber, isNonEmptyString } = require('../utils/validators');

const sendChatValidator = (req) => {
    const errors = [];
    if (!isPositiveNumber(req.body.toUserId)) errors.push('toUserId must be a positive number');
    if (!isNonEmptyString(req.body.content, 1)) errors.push('content is required');
    return errors;
};

const chatHistoryValidator = (req) => {
    const errors = [];
    const counterpartId = req.query.userId || req.query.coachId;
    if (!isPositiveNumber(counterpartId)) errors.push('userId or coachId query parameter must be a positive number');
    return errors;
};

const aiChatValidator = (req) => {
    const errors = [];
    if (!isNonEmptyString(req.body.message, 1)) errors.push('message is required');
    if (req.body.sessionId != null && !isNonEmptyString(req.body.sessionId, 6)) errors.push('sessionId must be a non-empty string');
    if (req.body.session_id != null && !isNonEmptyString(req.body.session_id, 6)) errors.push('session_id must be a non-empty string');
    return errors;
};

const sendUserChatValidator = (req) => {
    const errors = [];
    if (!isNonEmptyString(req.body.content, 1)) errors.push('content is required');
    return errors;
};

module.exports = {
    sendChatValidator,
    chatHistoryValidator,
    aiChatValidator,
    sendUserChatValidator
};
