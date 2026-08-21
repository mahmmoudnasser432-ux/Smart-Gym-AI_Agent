const { isPositiveNumber } = require('../utils/validators');

const buyTokensValidator = (req) => {
    const errors = [];
    if (!isPositiveNumber(req.body.amount)) errors.push('amount must be a positive number');
    return errors;
};

module.exports = { buyTokensValidator };
