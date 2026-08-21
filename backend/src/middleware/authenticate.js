const jwt = require('jsonwebtoken');
const { logError } = require('../utils/logger');

module.exports = (req, res, next) => {
    try {
        let token = null;
        let source = '';

        // 1. Try Authorization header (primary method)
        const authHeader = req.headers.authorization || '';
        if (authHeader) {
            const parts = authHeader.trim().split(/\s+/);
            if (parts.length === 2 && parts[0].toLowerCase() === 'bearer' && parts[1]) {
                token = parts[1];
                source = 'header';
            } else if (authHeader.trim().length > 0) {
                // Header exists but malformed — report it explicitly
                logError(`[AUTH] Malformed Authorization header: "${authHeader}" on ${req.method} ${req.originalUrl}`);
                return res.status(401).json({
                    status: 'error',
                    message: 'Invalid Authorization header format. Expected: Bearer <token>'
                });
            }
        }

        // 2. Fallback: query string ?token= (for multipart/form-data from mobile)
        if (!token && req.query && req.query.token) {
            token = req.query.token;
            source = 'query';
        }

        if (!token) {
            logError(`[AUTH] No token provided on ${req.method} ${req.originalUrl} | headers: ${JSON.stringify(Object.keys(req.headers))}`);
            return res.status(401).json({
                status: 'error',
                message: 'Authentication token is required. Send it as: Authorization: Bearer <token>'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        const isExpired = error.name === 'TokenExpiredError';
        logError(`[AUTH] Token ${isExpired ? 'expired' : 'invalid'} on ${req.method} ${req.originalUrl}: ${error.message}`);
        return res.status(401).json({
            status: 'error',
            message: isExpired ? 'Token has expired. Please login again.' : 'Invalid token'
        });
    }
};
