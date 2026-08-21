const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const isTest = process.env.NODE_ENV === 'test';

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isTest ? 10000 : 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest,
    keyGenerator: (req) => {
        return req.ip ? req.ip.replace(/:\d+$/, '') : req.ip;
    },
    message: {
        status: 'error',
        message: 'Too many requests, please try again later'
    }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest,
    keyGenerator: (req) => {
        return req.ip ? req.ip.replace(/:\d+$/, '') : req.ip;
    },
    message: {
        status: 'error',
        message: 'Too many authentication attempts, please try again later'
    }
});

module.exports = {
    helmetMiddleware: helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                baseUri: ["'self'"],
                fontSrc: ["'self'", 'https:', 'data:'],
                formAction: ["'self'"],
                frameAncestors: ["'self'"],
                imgSrc: ["'self'", 'data:'],
                objectSrc: ["'none'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                scriptSrcAttr: ["'none'"],
                styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
                upgradeInsecureRequests: []
            }
        }
    }),
    limiter,
    authLimiter
};
