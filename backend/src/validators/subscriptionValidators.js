const { isNonEmptyString, isPositiveNumber } = require('../utils/validators');

const createSubscriptionValidator = (req) => {
    const errors = [];

    if (!isNonEmptyString(req.body.planName)) errors.push('planName is required');
    if (!isPositiveNumber(req.body.durationMonths)) errors.push('durationMonths must be a positive number');
    if (req.body.amount != null && !isPositiveNumber(req.body.amount)) errors.push('amount must be a positive number');
    if (req.body.renewalType != null && !isNonEmptyString(req.body.renewalType)) errors.push('renewalType must be a non-empty string');

    return errors;
};

const cancelSubscriptionValidator = (req) => {
    const errors = [];
    if (!isPositiveNumber(req.body.subscriptionId)) errors.push('subscriptionId must be a positive number');
    return errors;
};

module.exports = {
    createSubscriptionValidator,
    cancelSubscriptionValidator
};
