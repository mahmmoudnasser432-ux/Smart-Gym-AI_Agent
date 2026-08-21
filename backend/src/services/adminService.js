const { sql, poolPromise } = require('../config/db');
const ApiError = require('../utils/apiError');

const getAttendanceStats = async () => {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT COUNT(*) AS totalVisits,
               SUM(CASE WHEN CAST(check_in_time AS date) = CAST(GETDATE() AS date) THEN 1 ELSE 0 END) AS todayVisits
        FROM dbo.attendance
    `);
    return result.recordset[0];
};

const getRevenueStats = async () => {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT ISNULL(SUM(amount), 0) AS totalRevenue,
               COUNT(*) AS paymentsCount
        FROM dbo.payment
        WHERE status = 'paid'
    `);
    return result.recordset[0];
};

const getMachineStats = async () => {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT m.machine_id, m.name, m.location, m.status, m.machine_count,
               COUNT(b.booking_id) AS totalBookings
        FROM dbo.machine m
        LEFT JOIN dbo.machinebooking b ON b.machine_id = m.machine_id
        GROUP BY m.machine_id, m.name, m.location, m.status, m.machine_count
        ORDER BY totalBookings DESC
    `);
    return result.recordset;
};

const getUserStats = async () => {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT
            (SELECT COUNT(*) FROM dbo.users) AS usersCount,
            (SELECT COUNT(*) FROM dbo.coach) AS coachesCount,
            (SELECT COUNT(*) FROM dbo.admin) AS adminsCount
    `);
    return result.recordset[0];
};

const getCrowdStats = async () => {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT TOP 20 snapshot_id, taken_at, gym_zone, machine_id, current_count, capacity_estimate
        FROM dbo.crowding_snapshot
        ORDER BY ISNULL(taken_at, GETDATE()) DESC, snapshot_id DESC
    `);
    return result.recordset;
};

// ── NEW: Full user listing ─────────────────────────────────────────────────────
const listAllUsers = async ({ page = 1, limit = 50, status } = {}) => {
    const pool = await poolPromise;
    const offset = (page - 1) * limit;
    const statusFilter = status ? `AND u.status = @status` : '';

    const request = pool.request()
        .input('limit', sql.Int, limit)
        .input('offset', sql.Int, offset);

    if (status) {
        request.input('status', sql.VarChar(20), status);
    }

    const result = await request.query(`
        SELECT u.user_id, u.username, u.email, u.phone, u.status, u.activity_level,
               u.budget, u.created_at, u.subscription_end_date,
               w.balance AS token_balance
        FROM dbo.users u
        LEFT JOIN dbo.tokenwallet w ON w.user_id = u.user_id
        WHERE 1=1 ${statusFilter}
        ORDER BY u.user_id DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    const countResult = await pool.request().query(
        `SELECT COUNT(*) AS total FROM dbo.users WHERE 1=1 ${statusFilter}`
    );

    return {
        users: result.recordset,
        total: countResult.recordset[0].total,
        page,
        limit
    };
};

const getUserById = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT u.user_id, u.username, u.email, u.phone, u.status,
                   u.activity_level, u.budget, u.created_at, u.subscription_end_date,
                   w.balance AS token_balance,
                   h.has_diabetes, h.has_hypertension, h.is_pregnant, h.heart_issues,
                   h.allergies, h.past_injuries, h.other_conditions, h.blood_type
            FROM dbo.users u
            LEFT JOIN dbo.tokenwallet w ON w.user_id = u.user_id
            LEFT JOIN dbo.user_health_profile h ON h.user_id = u.user_id
            WHERE u.user_id = @userId
        `);

    if (result.recordset.length === 0) {
        throw new ApiError(404, 'User not found');
    }

    return result.recordset[0];
};

const updateUserStatus = async (userId, status) => {
    const pool = await poolPromise;
    await pool.request()
        .input('userId', sql.Int, userId)
        .input('status', sql.VarChar(20), status)
        .query('UPDATE dbo.users SET status = @status WHERE user_id = @userId');
    return { updated: true };
};

// ── NEW: Feedback ──────────────────────────────────────────────────────────────
const listAllFeedback = async () => {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT f.feedback_id, f.user_id, f.subject, f.message, f.rating, f.created_at,
               u.username, u.email
        FROM dbo.feedback f
        JOIN dbo.users u ON u.user_id = f.user_id
        ORDER BY f.created_at DESC, f.feedback_id DESC
    `);
    return result.recordset;
};

// ── NEW: Orders ────────────────────────────────────────────────────────────────
const listAllOrders = async () => {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT oi.order_item_id, oi.order_id, oi.user_id, oi.product_id, oi.qty,
               oi.unit_price, oi.total_amount, oi.status, oi.created_at,
               p.name AS product_name,
               u.username, u.email
        FROM dbo.[Order_Item] oi
        JOIN dbo.product p ON p.product_id = oi.product_id
        JOIN dbo.users u ON u.user_id = oi.user_id
        ORDER BY oi.created_at DESC, oi.order_item_id DESC
    `);
    return result.recordset;
};

// ── NEW: Payments ──────────────────────────────────────────────────────────────
const listAllPayments = async () => {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT p.payment_id, p.user_id, p.subscription_id, p.amount, p.method, p.status, p.paid_at,
               u.username, u.email
        FROM dbo.payment p
        JOIN dbo.users u ON u.user_id = p.user_id
        ORDER BY p.paid_at DESC, p.payment_id DESC
    `);
    return result.recordset;
};

// ── NEW: Subscriptions ────────────────────────────────────────────────────────
const listAllSubscriptions = async () => {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT s.subscription_id, s.user_id, s.plan_name, s.start_date, s.end_date,
               s.status, s.renewal_type,
               u.username, u.email
        FROM dbo.subscription s
        JOIN dbo.users u ON u.user_id = s.user_id
        ORDER BY s.start_date DESC, s.subscription_id DESC
    `);
    return result.recordset;
};

// ── NEW: InBody Scans ─────────────────────────────────────────────────────────
const listAllScans = async (userId = null) => {
    const pool = await poolPromise;
    const request = pool.request();
    let whereClause = '';

    if (userId) {
        request.input('userId', sql.Int, userId);
        whereClause = 'WHERE ib.user_id = @userId';
    }

    const result = await request.query(`
        SELECT ib.scan_id, ib.user_id, ib.scan_timestamp, ib.weight_kg, ib.height_cm,
               ib.body_fat_pct, ib.muscle_mass, ib.bmi_score, ib.activity_level,
               ib.predicted_goal, ib.age, ib.gender, ib.inbody_score, ib.biological_age,
               u.username, u.email
        FROM dbo.InBodyScans ib
        JOIN dbo.users u ON u.user_id = ib.user_id
        ${whereClause}
        ORDER BY ib.scan_timestamp DESC, ib.scan_id DESC
    `);
    return result.recordset;
};

// ── NEW: Generated Plans ──────────────────────────────────────────────────────
const listAllGeneratedPlans = async () => {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT gp.plan_id, gp.user_id, gp.scan_id, gp.predicted_goal, gp.biological_age,
               gp.total_calories, gp.protein_g, gp.carbs_g, gp.fats_g, gp.activity_level,
               gp.training_frequency, gp.budget, gp.created_at,
               u.username, u.email
        FROM dbo.generated_plans gp
        JOIN dbo.users u ON u.user_id = gp.user_id
        ORDER BY gp.created_at DESC, gp.plan_id DESC
    `);
    return result.recordset;
};

// ── NEW: Attendance log ───────────────────────────────────────────────────────
const listAllAttendance = async ({ page = 1, limit = 100 } = {}) => {
    const pool = await poolPromise;
    const offset = (page - 1) * limit;
    const result = await pool.request()
        .input('limit', sql.Int, limit)
        .input('offset', sql.Int, offset)
        .query(`
            SELECT a.att_id, a.user_id, a.machine_id, a.check_in_time, a.check_out_time,
                   u.username, u.email,
                   m.name AS machine_name
            FROM dbo.attendance a
            JOIN dbo.users u ON u.user_id = a.user_id
            LEFT JOIN dbo.machine m ON m.machine_id = a.machine_id
            ORDER BY a.check_in_time DESC, a.att_id DESC
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);
    return result.recordset;
};

// ── NEW: AI Interactions audit ────────────────────────────────────────────────
const listAiInteractions = async ({ userId, type, limit = 50 } = {}) => {
    const pool = await poolPromise;
    const request = pool.request()
        .input('limit', sql.Int, limit);

    const conditions = [];
    if (userId) {
        request.input('userId', sql.Int, userId);
        conditions.push('ai.user_id = @userId');
    }
    if (type) {
        request.input('type', sql.VarChar(50), type);
        conditions.push('ai.interaction_type = @type');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await request.query(`
        SELECT TOP (@limit) ai.ai_id, ai.user_id, ai.interaction_type,
               ai.input_summary, ai.output_summary, ai.created_at,
               u.username, u.email
        FROM dbo.ai_agent_interaction ai
        JOIN dbo.users u ON u.user_id = ai.user_id
        ${where}
        ORDER BY ai.created_at DESC, ai.ai_id DESC
    `);
    return result.recordset;
};

// ── NEW: Dashboard summary ────────────────────────────────────────────────────
const getDashboardSummary = async () => {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT
            (SELECT COUNT(*) FROM dbo.users) AS total_users,
            (SELECT COUNT(*) FROM dbo.users WHERE CAST(created_at AS date) = CAST(GETDATE() AS date)) AS new_users_today,
            (SELECT COUNT(*) FROM dbo.coach) AS total_coaches,
            (SELECT COUNT(*) FROM dbo.subscription WHERE status = 'active') AS active_subscriptions,
            (SELECT COUNT(*) FROM dbo.machine WHERE status = 'Available') AS available_machines,
            (SELECT COUNT(*) FROM dbo.machine WHERE status = 'Reserved') AS reserved_machines,
            (SELECT ISNULL(SUM(amount),0) FROM dbo.payment WHERE status = 'paid') AS total_revenue,
            (SELECT ISNULL(SUM(amount),0) FROM dbo.payment WHERE status = 'paid' AND CAST(paid_at AS date) = CAST(GETDATE() AS date)) AS revenue_today,
            (SELECT COUNT(*) FROM dbo.attendance WHERE CAST(check_in_time AS date) = CAST(GETDATE() AS date)) AS checkins_today,
            (SELECT COUNT(*) FROM dbo.generated_plans) AS total_plans_generated,
            (SELECT COUNT(*) FROM dbo.feedback) AS total_feedback
    `);
    return result.recordset[0];
};

module.exports = {
    getAttendanceStats,
    getRevenueStats,
    getMachineStats,
    getUserStats,
    getCrowdStats,
    listAllUsers,
    getUserById,
    updateUserStatus,
    listAllFeedback,
    listAllOrders,
    listAllPayments,
    listAllSubscriptions,
    listAllScans,
    listAllGeneratedPlans,
    listAllAttendance,
    listAiInteractions,
    getDashboardSummary
};
