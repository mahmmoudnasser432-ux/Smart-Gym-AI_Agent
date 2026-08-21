const { sql, poolPromise } = require('../config/db');
const { withAllocatedIntId } = require('../utils/idAllocator');

const submitFeedback = async (userId, { subject, message, rating }) => {
    const pool = await poolPromise;
    const feedbackIdAllocation = await withAllocatedIntId(pool, 'dbo.feedback', 'feedback_id', 'feedbackId');
    const result = await feedbackIdAllocation.bind(pool.request())
        .input('userId', sql.Int, userId)
        .input('subject', sql.VarChar, subject || null)
        .input('message', sql.VarChar(sql.MAX), message)
        .input('rating', sql.Int, rating || null)
        .query(`
            INSERT INTO dbo.feedback (feedback_id, user_id, subject, message, rating, created_at)
            OUTPUT INSERTED.feedback_id, INSERTED.user_id, INSERTED.subject, INSERTED.message, INSERTED.rating, INSERTED.created_at
            VALUES (@feedbackId, @userId, @subject, @message, @rating, GETDATE())
        `);

    return result.recordset[0];
};

const getMyFeedback = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT feedback_id, user_id, subject, message, rating, created_at
            FROM dbo.feedback
            WHERE user_id = @userId
            ORDER BY created_at DESC, feedback_id DESC
        `);

    return result.recordset;
};

module.exports = {
    submitFeedback,
    getMyFeedback
};
