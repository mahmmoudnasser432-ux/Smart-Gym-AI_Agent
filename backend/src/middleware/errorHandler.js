const { logError } = require('../utils/logger');

module.exports = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    logError(err.message, err.stack);
    res.status(statusCode).json({
        status: 'error',
        message: err.message || 'Internal server error'
    });
};
