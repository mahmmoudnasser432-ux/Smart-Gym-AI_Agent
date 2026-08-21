const morgan = require('morgan');

const requestLogger = morgan('dev');

const logInfo = (...args) => console.log('[INFO]', ...args);
const logError = (...args) => console.error('[ERROR]', ...args);

module.exports = {
    requestLogger,
    logInfo,
    logError
};
