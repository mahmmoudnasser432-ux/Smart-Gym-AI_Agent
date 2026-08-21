const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const app = require('./app');
const { poolPromise } = require('./config/db');
const { setSocketServer } = require('./config/socket');
const { logInfo, logError } = require('./utils/logger');

const port = process.env.PORT || 5000;
const rawCorsOrigin = process.env.CORS_ORIGIN || '*';
const corsOrigins = rawCorsOrigin === '*'
    ? '*'
    : rawCorsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin || corsOrigins === '*' || corsOrigins.includes(origin)) {
                callback(null, true);
                return;
            }

            callback(new Error('Not allowed by Socket.io CORS'));
        }
    }
});

setSocketServer(io);

let databaseReady = false;

const getJoinId = (payload, keys) => {
    if (typeof payload === 'number' || typeof payload === 'string') {
        return Number(payload);
    }

    if (!payload || typeof payload !== 'object') {
        return null;
    }

    for (const key of keys) {
        if (payload[key] != null) {
            return Number(payload[key]);
        }
    }

    return null;
};

const joinChatRooms = (socket, user) => {
    if (!user || !user.userId || !user.role) {
        return;
    }

    if (user.role === 'coach') {
        socket.join(`coach:${user.userId}`);
    }

    if (user.role === 'user') {
        socket.join(`user:${user.userId}`);
    }
};

io.use((socket, next) => {
    const token = socket.handshake.auth?.token
        || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '')
        || socket.handshake.query?.token;

    if (!token) {
        next();
        return;
    }

    try {
        socket.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (error) {
        next(new Error('Invalid socket auth token'));
    }
});

io.on('connection', (socket) => {
    joinChatRooms(socket, socket.user);

    socket.on('chat:join', (payload) => {
        const userId = getJoinId(payload, ['userId', 'user_id', 'id']);
        if (!userId) return;
        socket.join(`user:${userId}`);
    });

    socket.on('user:join', (payload) => {
        const userId = getJoinId(payload, ['userId', 'user_id', 'id']);
        if (!userId) return;
        socket.join(`user:${userId}`);
    });

    socket.on('coach:join', (payload) => {
        const coachId = getJoinId(payload, ['coachId', 'coach_id', 'id']);
        if (!coachId) return;
        socket.join(`coach:${coachId}`);
    });

    socket.on('chat:joinCoach', (payload) => {
        const coachId = getJoinId(payload, ['coachId', 'coach_id', 'id']);
        if (!coachId) return;
        socket.join(`coach:${coachId}`);
    });
});

poolPromise
    .then(() => {
        databaseReady = true;
        logInfo('Database connection is ready.');
    })
    .catch((error) => {
        databaseReady = false;
        logError('Database connection failed. API is still running for health checks.', error);
    });

app.locals.isDatabaseReady = () => databaseReady;

server.listen(port, "0.0.0.0", () => {
    logInfo(`Smart Gym API running on port ${port}`);
});
