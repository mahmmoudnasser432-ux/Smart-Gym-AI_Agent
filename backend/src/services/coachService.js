const { sql, poolPromise } = require('../config/db');
const bcrypt = require('bcryptjs');
const ApiError = require('../utils/apiError');
const { withAllocatedIntId } = require('../utils/idAllocator');

const mapCoach = (row) => ({
    coach_id: row.coach_id,
    username: row.username,
    email: row.email,
    phone: row.phone,
    status: row.status,
    created_at: row.created_at,
    salary: row.salary,
    profile_picture_url: row.profile_picture_url
});

/**
 * List all coaches (accessible by authenticated users)
 */
const listCoaches = async () => {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT coach_id, username, email, phone, status, created_at, salary, profile_picture_url
        FROM dbo.coach
        ORDER BY coach_id ASC
    `);
    return result.recordset.map(mapCoach);
};

/**
 * Get a single coach by ID
 */
const getCoachById = async (coachId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('coachId', sql.Int, coachId)
        .query(`
            SELECT coach_id, username, email, phone, status, created_at, salary, profile_picture_url
            FROM dbo.coach
            WHERE coach_id = @coachId
        `);

    if (result.recordset.length === 0) {
        throw new ApiError(404, 'Coach not found');
    }
    return mapCoach(result.recordset[0]);
};

/**
 * Create a new coach (admin only)
 */
const createCoach = async ({ username, email, password, phone, salary, profile_picture_url }) => {
    const pool = await poolPromise;

    const existing = await pool.request()
        .input('email', sql.VarChar(150), email)
        .query('SELECT TOP 1 coach_id FROM dbo.coach WHERE email = @email');
    if (existing.recordset.length > 0) {
        throw new ApiError(409, 'Email already exists for a coach');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const coachIdAllocation = await withAllocatedIntId(pool, 'dbo.coach', 'coach_id', 'coachId');
    const result = await coachIdAllocation.bind(pool.request())
        .input('username', sql.VarChar(150), username)
        .input('email', sql.VarChar(150), email)
        .input('passwordHash', sql.VarChar(255), passwordHash)
        .input('phone', sql.VarChar(30), phone || null)
        .input('salary', sql.Decimal(10, 2), salary ? Number(salary) : null)
        .input('profilePictureUrl', sql.NVarChar(sql.MAX), profile_picture_url || null)
        .query(`
            INSERT INTO dbo.coach (coach_id, username, email, password_hash, phone, status, created_at, salary, profile_picture_url)
            OUTPUT INSERTED.coach_id, INSERTED.username, INSERTED.email, INSERTED.phone,
                   INSERTED.status, INSERTED.created_at, INSERTED.salary, INSERTED.profile_picture_url
            VALUES (@coachId, @username, @email, @passwordHash, @phone, 'active', GETDATE(), @salary, @profilePictureUrl)
        `);

    return mapCoach(result.recordset[0]);
};

/**
 * Update a coach (admin only)
 */
const updateCoach = async (coachId, { username, phone, status }) => {
    const pool = await poolPromise;
    const current = await getCoachById(coachId);

    await pool.request()
        .input('coachId', sql.Int, coachId)
        .input('username', sql.VarChar(150), username || current.username)
        .input('phone', sql.VarChar(30), phone ?? current.phone)
        .input('status', sql.VarChar(20), status || current.status)
        .query(`
            UPDATE dbo.coach
            SET username = @username,
                phone    = @phone,
                status   = @status
            WHERE coach_id = @coachId
        `);

    return getCoachById(coachId);
};

/**
 * Delete a coach (admin only)
 */
const deleteCoach = async (coachId) => {
    const pool = await poolPromise;
    await getCoachById(coachId); // throws 404 if not found

    await pool.request()
        .input('coachId', sql.Int, coachId)
        .query('DELETE FROM dbo.coach WHERE coach_id = @coachId');

    return { deleted: true };
};

/**
 * Get all messages sent by a coach (for admin audit)
 */
const getCoachMessages = async (coachId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('coachId', sql.Int, coachId)
        .query(`
            SELECT cm.message_id, cm.from_coach_id, cm.to_user_id, cm.content, cm.sent_at, cm.read_flag,
                   u.username AS user_name
            FROM dbo.chatmessage cm
            JOIN dbo.users u ON u.user_id = cm.to_user_id
            WHERE cm.from_coach_id = @coachId
            ORDER BY cm.sent_at DESC
        `);
    return result.recordset;
};

// ─── Rating ──────────────────────────────────────────────────────────────────

/**
 * Submit a rating for a coach.
 * Rules:
 *  - User (role=user) only — coaches cannot rate other coaches.
 *  - A user can rate the same coach only once every 30 days.
 *  - Each criterion (communication, knowledge, attitude, punctuality) must be 1–5.
 */
const rateCoach = async (userId, coachId, { communication, knowledge, attitude, punctuality, comment }) => {
    const pool = await poolPromise;

    // Validate each star value
    const stars = { communication, knowledge, attitude, punctuality };
    for (const [key, val] of Object.entries(stars)) {
        const n = Number(val);
        if (!val || n < 1 || n > 5 || !Number.isInteger(n)) {
            throw new ApiError(400, `"${key}" must be an integer between 1 and 5`);
        }
    }

    // Coach must exist
    await getCoachById(coachId);

    // 30-day cooldown check
    const existing = await pool.request()
        .input('userId', sql.Int, userId)
        .input('coachId', sql.Int, coachId)
        .query(`
            SELECT TOP 1 rated_at
            FROM dbo.coach_rating
            WHERE user_id = @userId AND coach_id = @coachId
            ORDER BY rated_at DESC
        `);

    if (existing.recordset.length > 0) {
        const lastRated = new Date(existing.recordset[0].rated_at);
        const daysSince = (Date.now() - lastRated.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 30) {
            const daysLeft = Math.ceil(30 - daysSince);
            throw new ApiError(429, `You already rated this coach. You can rate again in ${daysLeft} day(s).`);
        }
    }

    const comm = Number(communication);
    const know = Number(knowledge);
    const att = Number(attitude);
    const punct = Number(punctuality);
    const avg = parseFloat(((comm + know + att + punct) / 4).toFixed(2));

    const idAlloc = await withAllocatedIntId(pool, 'dbo.coach_rating', 'rating_id', 'ratingId');
    const result = await idAlloc.bind(pool.request())
        .input('userId', sql.Int, userId)
        .input('coachId', sql.Int, coachId)
        .input('communication', sql.TinyInt, comm)
        .input('knowledge', sql.TinyInt, know)
        .input('attitude', sql.TinyInt, att)
        .input('punctuality', sql.TinyInt, punct)
        .input('overallAvg', sql.Decimal(3, 2), avg)
        .input('comment', sql.NVarChar(500), comment ? String(comment).trim() : null)
        .query(`
            INSERT INTO dbo.coach_rating
                (rating_id, user_id, coach_id, communication, knowledge, attitude, punctuality, overall_avg, comment, rated_at)
            OUTPUT
                INSERTED.rating_id, INSERTED.communication, INSERTED.knowledge,
                INSERTED.attitude,  INSERTED.punctuality,   INSERTED.overall_avg,
                INSERTED.comment,   INSERTED.rated_at
            VALUES
                (@ratingId, @userId, @coachId, @communication, @knowledge, @attitude, @punctuality, @overallAvg, @comment, GETDATE())
        `);

    const row = result.recordset[0];
    return {
        rating_id: row.rating_id,
        coach_id: coachId,
        communication: row.communication,
        knowledge: row.knowledge,
        attitude: row.attitude,
        punctuality: row.punctuality,
        overall_avg: Number(row.overall_avg),
        comment: row.comment,
        rated_at: row.rated_at
    };
};

/**
 * Get all ratings for a specific coach — accessible by admin.
 * Includes per-user breakdown + aggregated averages.
 */
const getCoachRatings = async (coachId) => {
    const pool = await poolPromise;
    await getCoachById(coachId);

    const result = await pool.request()
        .input('coachId', sql.Int, coachId)
        .query(`
            SELECT
                cr.rating_id,
                cr.user_id,
                u.username      AS user_name,
                cr.communication,
                cr.knowledge,
                cr.attitude,
                cr.punctuality,
                cr.overall_avg,
                cr.comment,
                cr.rated_at
            FROM dbo.coach_rating cr
            JOIN dbo.users u ON u.user_id = cr.user_id
            WHERE cr.coach_id = @coachId
            ORDER BY cr.rated_at DESC
        `);

    const ratings = result.recordset;
    const count = ratings.length;

    const aggregated = count === 0 ? null : {
        communication: parseFloat((ratings.reduce((s, r) => s + r.communication, 0) / count).toFixed(2)),
        knowledge: parseFloat((ratings.reduce((s, r) => s + r.knowledge, 0) / count).toFixed(2)),
        attitude: parseFloat((ratings.reduce((s, r) => s + r.attitude, 0) / count).toFixed(2)),
        punctuality: parseFloat((ratings.reduce((s, r) => s + r.punctuality, 0) / count).toFixed(2)),
        overall_avg: parseFloat((ratings.reduce((s, r) => s + Number(r.overall_avg), 0) / count).toFixed(2))
    };

    return { coach_id: coachId, total_ratings: count, averages: aggregated, ratings };
};

/**
 * Check if a user has already rated a coach (and when).
 * Used by Flutter to decide whether to show the rating form or a message.
 */
const getMyRatingForCoach = async (userId, coachId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .input('coachId', sql.Int, coachId)
        .query(`
            SELECT TOP 1
                rating_id, communication, knowledge, attitude, punctuality,
                overall_avg, comment, rated_at
            FROM dbo.coach_rating
            WHERE user_id = @userId AND coach_id = @coachId
            ORDER BY rated_at DESC
        `);

    if (result.recordset.length === 0) {
        return { has_rated: false, can_rate_at: null, rating: null };
    }

    const r = result.recordset[0];
    const lastRated = new Date(r.rated_at);
    const canRateAt = new Date(lastRated.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
        has_rated: true,
        can_rate_at: canRateAt.toISOString(),
        rating: {
            rating_id: r.rating_id,
            communication: r.communication,
            knowledge: r.knowledge,
            attitude: r.attitude,
            punctuality: r.punctuality,
            overall_avg: Number(r.overall_avg),
            comment: r.comment,
            rated_at: r.rated_at
        }
    };
};


// ── NEW: Tracking Customers ───────────────────────────────────────────────

const getTrackingCustomers = async (coachId) => {
    // Return all active users
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT user_id, username, profile_picture_url, activity_level 
        FROM dbo.users 
        WHERE status = 'active'
    `);
    return result.recordset;
};

const getCustomerAttendance = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT booking_id, start_time, end_time, status
            FROM dbo.machinebooking
            WHERE user_id = @userId AND start_time <= GETDATE()
            ORDER BY start_time DESC
        `);
    return result.recordset;
};

const getCustomerProgress = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT TOP 1 scan_id, weight_kg, body_fat_pct, inbody_score, created_at, training_frequency
            FROM dbo.InBodyScans
            WHERE user_id = @userId
            ORDER BY created_at DESC
        `);

    if (result.recordset.length === 0) {
        return null; // No scans
    }

    const scan = result.recordset[0];
    let commitment = 'Fair';
    if (scan.training_frequency >= 4) commitment = 'Excellent';
    else if (scan.training_frequency === 3) commitment = 'Good';

    return {
        weight: scan.weight_kg,
        body_fat: scan.body_fat_pct,
        commitment: commitment,
        last_scan_date: scan.created_at
    };
};

const getCustomerActivity = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT TOP 1 start_time
            FROM dbo.machinebooking
            WHERE user_id = @userId AND start_time <= GETDATE()
            ORDER BY start_time DESC
        `);

    if (result.recordset.length === 0) {
        return { inactive_days: null, message: 'No past bookings found', last_booking_date: null };
    }

    const lastDate = new Date(result.recordset[0].start_time);
    const now = new Date();
    const diffTime = now.getTime() - lastDate.getTime();
    const inactive_days = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return { inactive_days, last_booking_date: lastDate };
};

const sendActivityAlert = async (coachId, userId) => {
    const chatService = require('./chatService'); // Lazy load to avoid circular

    const activity = await getCustomerActivity(userId);
    let messageContent = `Hello! We noticed you haven't attended the gym recently. We miss you!`;
    if (activity.inactive_days !== null && activity.inactive_days > 0) {
        messageContent = `Hello! It's been ${activity.inactive_days} days since your last gym session. We miss you! Come back and stay active!`;
    }

    const actor = { role: 'coach', userId: coachId };
    const message = await chatService.sendMessage(actor, {
        toUserId: userId,
        content: messageContent
    });

    return message;
};

module.exports = {
    listCoaches,
    getCoachById,
    createCoach,
    updateCoach,
    deleteCoach,
    getCoachMessages,
    rateCoach,
    getCoachRatings,
    getMyRatingForCoach,
    getTrackingCustomers,
    getCustomerAttendance,
    getCustomerProgress,
    getCustomerActivity,
    sendActivityAlert
};
