const isEmail = (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isNonEmptyString = (value, min = 1) => typeof value === 'string' && value.trim().length >= min;

const isPositiveNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

const isRole = (value) => ['user', 'coach', 'admin'].includes(value);

const validateRequired = (value, field, errors) => {
    if (value == null || value === '') {
        errors.push(`${field} is required`);
    }
};

module.exports = {
    isEmail,
    isNonEmptyString,
    isPositiveNumber,
    isRole,
    validateRequired
};
