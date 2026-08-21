const jwt = require('jsonwebtoken');

/**
 * optionalAuth middleware
 * If a valid Bearer token is present → populates req.user
 * If no token or invalid token → continues without error (req.user = null)
 * Endpoints using this middleware decide themselves what to do when req.user is null.
 */
module.exports = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || '';
        const [scheme, token] = authHeader.split(' ');

        if (scheme === 'Bearer' && token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
        } else {
            req.user = null;
        }
    } catch (_) {
        // Invalid / expired token — treat as unauthenticated
        req.user = null;
    }
    next();
};
