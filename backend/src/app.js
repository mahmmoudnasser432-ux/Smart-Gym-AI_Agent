const express = require('express');
const path = require('path');
const routes = require('./routes');
const { requestLogger } = require('./utils/logger');
const { setupSwagger } = require('./config/swagger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { helmetMiddleware, limiter } = require('./middleware/security');

const app = express();
app.set('trust proxy', 1); // Trust the reverse proxy (Railway)
const cors = require('cors');

const rawCorsOrigin = process.env.CORS_ORIGIN || '*';
const corsOrigins = rawCorsOrigin === '*'
    ? '*'
    : rawCorsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);

app.use(helmetMiddleware);

app.use(cors({
    origin: corsOrigins === '*' ? true : corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(limiter);

// ─── Serve profile pictures statically (with CORS) ──────────
app.use('/uploads', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(path.join(__dirname, '../uploads')));


setupSwagger(app);

app.get('/', (req, res) => {
    res.json({
        status: 'success',
        data: {
            service: 'Smart Gym API',
            health: '/health',
            documentation: '/api/docs'
        }
    });
});

app.get(['/health', '/healt'], (req, res) => {
    const isDatabaseReady = req.app.locals.isDatabaseReady;

    res.json({
        status: 'success',
        data: {
            message: 'Smart Gym backend is running',
            database: typeof isDatabaseReady === 'function' && isDatabaseReady() ? 'connected' : 'unavailable'
        }
    });
});

// ─── Debug endpoint: shows received headers ──
// Disabled in production to avoid leaking Authorization tokens / request headers.
if (process.env.NODE_ENV !== 'production') {
    app.get('/debug/headers', (req, res) => {
        const authHeader = req.headers.authorization || null;
        res.json({
            status: 'success',
            data: {
                received_auth_header: authHeader,
                note: authHeader
                    ? `Header received: "${authHeader}"`
                    : 'No Authorization header was received by the server',
                all_headers: req.headers
            }
        });
    });
}

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
