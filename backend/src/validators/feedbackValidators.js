const { isNonEmptyString } = require('../utils/validators');

const createFeedbackValidator = (req) => {
    const errors = [];

    if (!isNonEmptyString(req.body.message, 3)) errors.push('message is required');

    if (req.body.subject != null && !isNonEmptyString(req.body.subject)) {
        errors.push('subject must be a non-empty string');
    }

    if (req.body.rating != null) {
        const rating = Number(req.body.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            errors.push('rating must be an integer between 1 and 5');
        }
    }

    return errors;
};

module.exports = { createFeedbackValidator };
