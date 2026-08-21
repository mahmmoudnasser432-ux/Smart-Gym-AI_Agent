const { isNonEmptyString, isPositiveNumber } = require('../utils/validators');

const createOrderValidator = (req) => {
    const errors = [];
    if (!isPositiveNumber(req.body.productId)) errors.push('productId must be a positive number');
    if (!isPositiveNumber(req.body.quantity)) errors.push('quantity must be a positive number');
    return errors;
};

const createProductValidator = (req) => {
    const errors = [];
    if (!isNonEmptyString(req.body.name)) errors.push('name is required');
    if (!isPositiveNumber(req.body.price)) errors.push('price must be a positive number');
    if (!isPositiveNumber(req.body.stockQty)) errors.push('stockQty must be a positive number');
    return errors;
};

module.exports = {
    createOrderValidator,
    createProductValidator
};
