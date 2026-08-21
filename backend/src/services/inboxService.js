const { sql, poolPromise } = require('../config/db');
const ApiError = require('../utils/apiError');
const { withAllocatedIntId } = require('../utils/idAllocator');

// ── Admin: Get all users for inbox list ─────────────────────────────────────
const getInboxUserList = async () => {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT DISTINCT
            u.user_id,
            u.username,
            u.profile_picture_url,
            u.phone,
            (
                SELECT TOP 1 content
                FROM dbo.inbox_message im
                WHERE im.recipient_id = u.user_id OR im.sender_id = u.user_id
                ORDER BY im.sent_at DESC
            ) AS last_message,
            (
                SELECT TOP 1 sent_at
                FROM dbo.inbox_message im
                WHERE im.recipient_id = u.user_id OR im.sender_id = u.user_id
                ORDER BY im.sent_at DESC
            ) AS last_message_at,
            (
                SELECT COUNT(*)
                FROM dbo.inbox_message im
                WHERE im.recipient_id = u.user_id AND im.sender_type = 'user' AND im.read_flag = 0
            ) AS unread_count
        FROM dbo.users u
        WHERE u.status = 'active'
        ORDER BY last_message_at DESC
    `);
    return result.recordset;
};

// ── Admin: Get conversation with a specific user ─────────────────────────────
const getInboxConversation = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT message_id, sender_id, sender_type, recipient_id, content, sent_at, read_flag,
                   sender_type AS sent_by, 
                   1 AS from_coach_id, -- Admin is represented as coach 1 for frontend compatibility
                   recipient_id AS to_user_id
            FROM dbo.inbox_message
            WHERE recipient_id = @userId OR (sender_id = @userId AND sender_type = 'user')
            ORDER BY sent_at ASC, message_id ASC
        `);

    // Mark user messages as read
    await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            UPDATE dbo.inbox_message
            SET read_flag = 1
            WHERE sender_id = @userId AND sender_type = 'user' AND read_flag = 0
        `);

    return result.recordset;
};

// ── Admin: Send message to a user ────────────────────────────────────────────
const adminSendMessage = async (adminId, userId, content) => {
    const pool = await poolPromise;

    // Verify user exists
    const userCheck = await pool.request()
        .input('userId', sql.Int, userId)
        .query('SELECT user_id FROM dbo.users WHERE user_id = @userId');
    if (userCheck.recordset.length === 0) {
        throw new ApiError(404, 'User not found');
    }

    const idAlloc = await withAllocatedIntId(pool, 'dbo.inbox_message', 'message_id', 'msgId');
    const result = await idAlloc.bind(pool.request())
        .input('senderId', sql.Int, adminId)
        .input('recipientId', sql.Int, userId)
        .input('content', sql.NVarChar(sql.MAX), content)
        .query(`
            INSERT INTO dbo.inbox_message (message_id, sender_id, sender_type, recipient_id, content, sent_at, read_flag)
            OUTPUT 
                INSERTED.message_id, INSERTED.sender_id, INSERTED.sender_type, 
                INSERTED.recipient_id, INSERTED.content, INSERTED.sent_at, INSERTED.read_flag,
                INSERTED.sender_type AS sent_by, 
                1 AS from_coach_id, 
                INSERTED.recipient_id AS to_user_id
            VALUES (@msgId, @senderId, 'admin', @recipientId, @content, GETDATE(), 0)
        `);

    const msg = result.recordset[0];
    const io = require('../config/socket').getSocketServer();
    if (io) {
        io.to(`user:${userId}`).emit('message:new', msg);
    }
    return msg;
};

// ── User: Get their inbox (messages from admin + their replies) ──────────────
const getUserInbox = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT message_id, sender_id, sender_type, recipient_id, content, sent_at, read_flag,
                   sender_type AS sent_by, 
                   1 AS from_coach_id, 
                   @userId AS to_user_id
            FROM dbo.inbox_message
            WHERE recipient_id = @userId OR (sender_id = @userId AND sender_type = 'user')
            ORDER BY sent_at ASC, message_id ASC
        `);

    // Mark admin messages as read
    await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            UPDATE dbo.inbox_message
            SET read_flag = 1
            WHERE recipient_id = @userId AND sender_type = 'admin' AND read_flag = 0
        `);

    return result.recordset;
};

// ── User: Reply to admin ──────────────────────────────────────────────────────
const userReplyToAdmin = async (userId, content) => {
    const pool = await poolPromise;

    // Get admin id (use first active admin)
    const adminResult = await pool.request()
        .query('SELECT TOP 1 admin_id FROM dbo.admin');
    if (adminResult.recordset.length === 0) {
        throw new ApiError(503, 'No admin available');
    }
    const adminId = adminResult.recordset[0].admin_id;

    const idAlloc = await withAllocatedIntId(pool, 'dbo.inbox_message', 'message_id', 'msgId');
    const result = await idAlloc.bind(pool.request())
        .input('senderId', sql.Int, userId)
        .input('recipientId', sql.Int, userId)   // recipient_id always = user_id for lookups
        .input('content', sql.NVarChar(sql.MAX), content)
        .query(`
            INSERT INTO dbo.inbox_message (message_id, sender_id, sender_type, recipient_id, content, sent_at, read_flag)
            OUTPUT 
                INSERTED.message_id, INSERTED.sender_id, INSERTED.sender_type, 
                INSERTED.recipient_id, INSERTED.content, INSERTED.sent_at, INSERTED.read_flag,
                INSERTED.sender_type AS sent_by, 
                1 AS from_coach_id, 
                INSERTED.sender_id AS to_user_id
            VALUES (@msgId, @senderId, 'user', @recipientId, @content, GETDATE(), 0)
        `);

    const msg = result.recordset[0];
    const io = require('../config/socket').getSocketServer();
    if (io) {
        io.to(`user:${userId}`).emit('message:new', msg);
        io.to('admin').emit('message:new', msg);
    }
    return msg;
};

// ── User: Get unread count ────────────────────────────────────────────────────
const getUserUnreadCount = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT COUNT(*) AS unread_count
            FROM dbo.inbox_message
            WHERE recipient_id = @userId AND sender_type = 'admin' AND read_flag = 0
        `);
    return { unread_count: result.recordset[0].unread_count };
};

module.exports = {
    getInboxUserList,
    getInboxConversation,
    adminSendMessage,
    getUserInbox,
    userReplyToAdmin,
    getUserUnreadCount,
};
