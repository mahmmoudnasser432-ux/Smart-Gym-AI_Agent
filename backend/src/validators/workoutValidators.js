const { isPositiveNumber } = require('../utils/validators');

const workoutGenerateValidator = (req) => {
    const errors = [];
    const { goal, weight, height } = req.body;

    if (goal != null && !['fat loss', 'muscle gain', 'balanced'].includes(goal)) {
        errors.push('goal must be fat loss, muscle gain, or balanced');
    }

    if (weight != null && !isPositiveNumber(weight)) errors.push('weight must be a positive number');
    if (height != null && !isPositiveNumber(height)) errors.push('height must be a positive number');

    return errors;
};

const workoutProgressValidator = (req) => {
    const errors = [];
    if (!req.body || Object.keys(req.body).length === 0) {
        errors.push('progress payload is required');
    }
    return errors;
};

module.exports = {
    workoutGenerateValidator,
    workoutProgressValidator
};
