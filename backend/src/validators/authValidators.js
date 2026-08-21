const { isEmail, isNonEmptyString, isRole, validateRequired } = require('../utils/validators');

const registerValidator = (req) => {
    const { username, email, password } = req.body;
    const errors = [];
    validateRequired(username, 'username', errors);
    validateRequired(email, 'email', errors);
    validateRequired(password, 'password', errors);

    if (email && !isEmail(email)) errors.push('email must be valid');
    if (password && !isNonEmptyString(password, 6)) errors.push('password must be at least 6 characters');

    return errors;
};

const loginValidator = (req) => {
    const { email, password, role } = req.body;
    const errors = [];
    validateRequired(email, 'email', errors);
    validateRequired(password, 'password', errors);

    if (email && !isEmail(email)) errors.push('email must be valid');
    if (role && !isRole(role)) errors.push('role must be one of user, coach, admin');

    return errors;
};

module.exports = {
    registerValidator,
    loginValidator
};
