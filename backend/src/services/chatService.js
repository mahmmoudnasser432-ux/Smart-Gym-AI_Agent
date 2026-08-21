const { sql, poolPromise } = require('../config/db');
const aiChatService = require('../ai-agent/aiChatService');
const userService = require('./userService');
const { getSocketServer } = require('../config/socket');
const { withAllocatedIntId } = require('../utils/idAllocator');
const ApiError = require('../utils/apiError');

const mapDirectMessage = (row) => ({
    ...row,
    sender_type: row.sender_type || row.sent_by,
    sent_by: row.sent_by || row.sender_type
});

const emitDirectMessage = (message) => {
    const io = getSocketServer();
    if (!io) {
        return;
    }

    io.to(`user:${message.to_user_id}`).emit('chat:message', message);
    io.to(`coach:${message.from_coach_id}`).emit('chat:message', message);
    io.to(`user:${message.to_user_id}`).emit('message:new', message);
    io.to(`coach:${message.from_coach_id}`).emit('message:new', message);
};

const directMessageSelect = `
    SELECT
        message_id,
        from_coach_id,
        to_user_id,
        content,
        sent_at,
        read_flag,
        sender_type,
        sender_type AS sent_by
    FROM dbo.chatmessage
`;

const sendMessage = async (actor, { toUserId, content }) => {
    // Admin sends via inbox system (chatmessage requires a valid coach FK)
    if (actor.role === 'admin') {
        const inboxService = require('./inboxService');
        return inboxService.adminSendMessage(actor.userId, toUserId, content);
    }

    if (actor.role !== 'coach') {
        throw new ApiError(403, 'Only coaches can send direct messages to users');
    }

    const pool = await poolPromise;
    const messageIdAllocation = await withAllocatedIntId(pool, 'dbo.chatmessage', 'message_id', 'messageId');
    const result = await messageIdAllocation.bind(pool.request())
        .input('fromCoachId', sql.Int, actor.userId)
        .input('toUserId', sql.Int, toUserId)
        .input('content', sql.NVarChar(sql.MAX), content)
        .query(`
            INSERT INTO dbo.chatmessage (message_id, from_coach_id, to_user_id, content, sent_at, read_flag, sender_type)
            OUTPUT INSERTED.message_id, INSERTED.from_coach_id, INSERTED.to_user_id, INSERTED.content, INSERTED.sent_at, INSERTED.read_flag, INSERTED.sender_type, INSERTED.sender_type AS sent_by
            VALUES (@messageId, @fromCoachId, @toUserId, @content, GETDATE(), 0, 'coach')
        `);

    const message = mapDirectMessage(result.recordset[0]);
    emitDirectMessage(message);

    return message;
};

/**
 * User sends a message — system auto-assigns an available coach.
 * If the user already has a previous conversation with a coach,
 * the same coach is reused for continuity.
 */
const sendToCoach = async (actor, { content }) => {
    if (actor.role !== 'user') {
        throw new ApiError(403, 'Only users can use this endpoint');
    }

    const pool = await poolPromise;

    // Check if user already has an assigned coach (previous conversation)
    const previousConvo = await pool.request()
        .input('userId', sql.Int, actor.userId)
        .query(`
            SELECT TOP 1 from_coach_id
            FROM dbo.chatmessage
            WHERE to_user_id = @userId
            ORDER BY sent_at DESC
        `);

    let assignedCoachId;

    if (previousConvo.recordset.length > 0) {
        // Reuse the existing coach
        assignedCoachId = previousConvo.recordset[0].from_coach_id;
    } else {
        // Pick a random active coach
        const activeCoaches = await pool.request()
            .query(`
                SELECT coach_id FROM dbo.coach
                WHERE status = 'active'
            `);

        if (activeCoaches.recordset.length === 0) {
            throw new ApiError(503, 'No available coaches at the moment. Please try again later.');
        }

        const randomIndex = Math.floor(Math.random() * activeCoaches.recordset.length);
        assignedCoachId = activeCoaches.recordset[randomIndex].coach_id;
    }

    // Insert the message under the assigned coach/user pair — sender_type = 'user'
    const messageIdAllocation = await withAllocatedIntId(pool, 'dbo.chatmessage', 'message_id', 'messageId');
    const result = await messageIdAllocation.bind(pool.request())
        .input('fromCoachId', sql.Int, assignedCoachId)
        .input('toUserId', sql.Int, actor.userId)
        .input('content', sql.NVarChar(sql.MAX), content)
        .query(`
            INSERT INTO dbo.chatmessage (message_id, from_coach_id, to_user_id, content, sent_at, read_flag, sender_type)
            OUTPUT INSERTED.message_id, INSERTED.from_coach_id, INSERTED.to_user_id, INSERTED.content, INSERTED.sent_at, INSERTED.read_flag, INSERTED.sender_type, INSERTED.sender_type AS sent_by
            VALUES (@messageId, @fromCoachId, @toUserId, @content, GETDATE(), 0, 'user')
        `);

    const message = mapDirectMessage(result.recordset[0]);
    emitDirectMessage(message);

    return message;
};

const getHistory = async (actor, counterpartId) => {
    const pool = await poolPromise;

    if (actor.role === 'coach') {
        const result = await pool.request()
            .input('coachId', sql.Int, actor.userId)
            .input('userId', sql.Int, counterpartId)
            .query(`
                ${directMessageSelect}
                WHERE from_coach_id = @coachId AND to_user_id = @userId
                ORDER BY sent_at ASC, message_id ASC
            `);

        return result.recordset.map(mapDirectMessage);
    }

    if (actor.role === 'user') {
        const result = await pool.request()
            .input('coachId', sql.Int, counterpartId)
            .input('userId', sql.Int, actor.userId)
            .query(`
                ${directMessageSelect}
                WHERE from_coach_id = @coachId AND to_user_id = @userId
                ORDER BY sent_at ASC, message_id ASC
            `);

        return result.recordset.map(mapDirectMessage);
    }

    throw new ApiError(403, 'Unsupported role for chat history');
};

/**
 * User fetches their chat history without needing to know the coachId.
 * Auto-detects the assigned coach from previous messages.
 */
const getMyHistory = async (actor) => {
    if (actor.role !== 'user') {
        throw new ApiError(403, 'Only users can access this endpoint');
    }

    const pool = await poolPromise;

    // Auto-detect the assigned coach for this user
    const coachResult = await pool.request()
        .input('userId', sql.Int, actor.userId)
        .query(`
            SELECT TOP 1 from_coach_id
            FROM dbo.chatmessage
            WHERE to_user_id = @userId
            ORDER BY sent_at DESC
        `);

    if (coachResult.recordset.length === 0) {
        return { coach_id: null, messages: [] };
    }

    const coachId = coachResult.recordset[0].from_coach_id;

    const messages = await pool.request()
        .input('coachId', sql.Int, coachId)
        .input('userId', sql.Int, actor.userId)
        .query(`
            ${directMessageSelect}
            WHERE from_coach_id = @coachId AND to_user_id = @userId
            ORDER BY sent_at ASC, message_id ASC
        `);

    return {
        coach_id: coachId,
        messages: messages.recordset.map(mapDirectMessage)
    };
};

const getConversations = async (actor) => {
    const pool = await poolPromise;

    if (actor.role === 'coach') {
        const result = await pool.request()
            .input('coachId', sql.Int, actor.userId)
            .query(`
                WITH ranked_messages AS (
                    SELECT
                        cm.to_user_id AS partner_id,
                        cm.content,
                        cm.sent_at,
                        ROW_NUMBER() OVER (PARTITION BY cm.to_user_id ORDER BY cm.sent_at DESC, cm.message_id DESC) AS row_num
                    FROM dbo.chatmessage cm
                    WHERE cm.from_coach_id = @coachId
                )
                SELECT
                    rm.partner_id AS user_id,
                    rm.partner_id,
                    u.username,
                    rm.content AS last_message,
                    rm.sent_at,
                    'user' AS partner_role
                FROM ranked_messages rm
                JOIN dbo.users u ON u.user_id = rm.partner_id
                WHERE rm.row_num = 1
                ORDER BY rm.sent_at DESC
            `);

        return result.recordset;
    }

    if (actor.role === 'user') {
        const result = await pool.request()
            .input('userId', sql.Int, actor.userId)
            .query(`
                WITH ranked_messages AS (
                    SELECT
                        from_coach_id AS partner_id,
                        content,
                        sent_at,
                        ROW_NUMBER() OVER (PARTITION BY from_coach_id ORDER BY sent_at DESC, message_id DESC) AS row_num
                    FROM dbo.chatmessage
                    WHERE to_user_id = @userId
                )
                SELECT partner_id, content AS last_message, sent_at, 'coach' AS partner_role
                FROM ranked_messages
                WHERE row_num = 1
                ORDER BY sent_at DESC
            `);

        return result.recordset;
    }

    // ── Admin: returns ALL active users (no need for prior message) ──────────
    if (actor.role === 'admin') {
        const result = await pool.request().query(`
            SELECT
                u.user_id,
                u.user_id AS partner_id,
                u.username,
                u.profile_picture_url,
                (
                    SELECT TOP 1 content
                    FROM dbo.inbox_message im
                    WHERE im.recipient_id = u.user_id OR (im.sender_id = u.user_id AND im.sender_type = 'user')
                    ORDER BY im.sent_at DESC
                ) AS last_message,
                (
                    SELECT TOP 1 sent_at
                    FROM dbo.inbox_message im
                    WHERE im.recipient_id = u.user_id OR (im.sender_id = u.user_id AND im.sender_type = 'user')
                    ORDER BY im.sent_at DESC
                ) AS last_message_at,
                (
                    SELECT COUNT(*)
                    FROM dbo.inbox_message im
                    WHERE im.recipient_id = u.user_id AND im.sender_type = 'user' AND im.read_flag = 0
                ) AS unread_count,
                'user' AS partner_role
            FROM dbo.users u
            WHERE u.status = 'active'
            ORDER BY last_message_at DESC
        `);
        return result.recordset;
    }

    throw new ApiError(403, 'Unsupported role for conversations');
};

const getAiReply = async (userId, message) => {
    const profile = await userService.getProfile(userId);
    const reply = await aiChatService({ message, profile });
    const pool = await poolPromise;
    const interactionIdAllocation = await withAllocatedIntId(pool, 'dbo.ai_agent_interaction', 'ai_id', 'interactionId');
    await interactionIdAllocation.bind(pool.request())
        .input('userId', sql.Int, userId)
        .input('type', sql.VarChar(50), 'ai_chat')
        .input('input', sql.VarChar(sql.MAX), message)
        .input('output', sql.VarChar(sql.MAX), reply.reply)
        .query(`
            INSERT INTO dbo.ai_agent_interaction (ai_id, user_id, interaction_type, input_summary, output_summary, created_at)
            VALUES (@interactionId, @userId, @type, @input, @output, GETDATE())
        `);

    return reply;
};

const storeAiConversation = async (userId, sessionId, userMessage, aiReply) => {
    const pool = await poolPromise;
    const request = pool.request()
        .input('userId', sql.Int, userId)
        .input('sessionId', sql.VarChar(255), sessionId)
        .input('userMessage', sql.NVarChar(sql.MAX), userMessage)
        .input('aiReply', sql.NVarChar(sql.MAX), aiReply);

    await request.query(`
        INSERT INTO dbo.chat_history (user_id, session_id, sender_type, message_text, created_at)
        VALUES
            (@userId, @sessionId, 'user', @userMessage, GETDATE()),
            (@userId, @sessionId, 'ai', @aiReply, DATEADD(MILLISECOND, 1, GETDATE()))
    `);

    return { saved: true };
};

const getAiChatHistory = async (userId, sessionId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .input('sessionId', sql.VarChar(255), sessionId)
        .query(`
            SELECT chat_id, user_id, session_id, sender_type, message_text, created_at
            FROM dbo.chat_history
            WHERE user_id = @userId AND session_id = @sessionId
            ORDER BY created_at ASC, chat_id ASC
        `);

    return result.recordset;
};

const listAiChatSessions = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            WITH ranked_sessions AS (
                SELECT
                    session_id,
                    message_text,
                    sender_type,
                    created_at,
                    ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at DESC, chat_id DESC) AS row_num
                FROM dbo.chat_history
                WHERE user_id = @userId
            )
            SELECT session_id, message_text AS last_message, sender_type, created_at
            FROM ranked_sessions
            WHERE row_num = 1
            ORDER BY created_at DESC
        `);

    return result.recordset;
};

module.exports = {
    sendMessage,
    sendToCoach,
    getHistory,
    getMyHistory,
    getConversations,
    getAiReply,
    storeAiConversation,
    getAiChatHistory,
    listAiChatSessions
};
