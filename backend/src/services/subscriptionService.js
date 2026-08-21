const { sql, poolPromise } = require('../config/db');
const ApiError = require('../utils/apiError');
const { withAllocatedIntId } = require('../utils/idAllocator');

const mapSubscription = (row) => ({
    subscription_id: row.subscription_id,
    user_id: row.user_id,
    plan_name: row.plan_name,
    start_date: row.start_date,
    end_date: row.end_date,
    status: row.status,
    renewal_type: row.renewal_type
});

const getCurrentSubscription = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT TOP 1 subscription_id, user_id, plan_name, start_date, end_date, status, renewal_type
            FROM dbo.subscription
            WHERE user_id = @userId AND status = 'active'
            ORDER BY ISNULL(end_date, start_date) DESC, subscription_id DESC
        `);

    return result.recordset[0] ? mapSubscription(result.recordset[0]) : null;
};

const listSubscriptions = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT subscription_id, user_id, plan_name, start_date, end_date, status, renewal_type
            FROM dbo.subscription
            WHERE user_id = @userId
            ORDER BY ISNULL(start_date, GETDATE()) DESC, subscription_id DESC
        `);

    return result.recordset.map(mapSubscription);
};

const createSubscription = async (userId, { planName, startDate, durationMonths, renewalType, amount, method }) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const subscriptionIdAllocation = await withAllocatedIntId(transaction, 'dbo.subscription', 'subscription_id', 'subscriptionId');
        const paymentIdAllocation = await withAllocatedIntId(transaction, 'dbo.payment', 'payment_id', 'paymentId');
        const normalizedStartDate = startDate || new Date().toISOString().slice(0, 10);
        const normalizedAmount = Number(amount || 0);

        await new sql.Request(transaction)
            .input('userId', sql.Int, userId)
            .query(`
                UPDATE dbo.subscription
                SET status = 'expired'
                WHERE user_id = @userId AND status IN ('active', 'pending')
            `);

        const subscriptionResult = await subscriptionIdAllocation.bind(new sql.Request(transaction))
            .input('userId', sql.Int, userId)
            .input('planName', sql.VarChar, planName)
            .input('startDate', sql.Date, normalizedStartDate)
            .input('durationMonths', sql.Int, durationMonths)
            .input('renewalType', sql.VarChar, renewalType || 'manual')
            .query(`
                INSERT INTO dbo.subscription (
                    subscription_id, user_id, plan_name, start_date, end_date, status, renewal_type
                )
                OUTPUT INSERTED.subscription_id, INSERTED.user_id, INSERTED.plan_name,
                       INSERTED.start_date, INSERTED.end_date, INSERTED.status, INSERTED.renewal_type
                VALUES (
                    @subscriptionId, @userId, @planName, @startDate,
                    DATEADD(MONTH, @durationMonths, @startDate), 'active', @renewalType
                )
            `);

        if (normalizedAmount > 0) {
            await paymentIdAllocation.bind(new sql.Request(transaction))
                .input('userId', sql.Int, userId)
                .input('subscriptionId', sql.Int, subscriptionResult.recordset[0].subscription_id)
                .input('amount', sql.Decimal(10, 2), normalizedAmount)
                .input('method', sql.VarChar, method || 'card')
                .query(`
                    INSERT INTO dbo.payment (payment_id, user_id, subscription_id, amount, method, status, paid_at)
                    VALUES (@paymentId, @userId, @subscriptionId, @amount, @method, 'paid', GETDATE())
                `);
        }

        await new sql.Request(transaction)
            .input('userId', sql.Int, userId)
            .query(`
                UPDATE dbo.users
                SET subscription_end_date = (
                    SELECT TOP 1 end_date
                    FROM dbo.subscription
                    WHERE user_id = @userId AND status = 'active'
                    ORDER BY end_date DESC, subscription_id DESC
                )
                WHERE user_id = @userId
            `);

        await transaction.commit();
        return mapSubscription(subscriptionResult.recordset[0]);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

const cancelSubscription = async (userId, subscriptionId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('subscriptionId', sql.Int, subscriptionId)
        .input('userId', sql.Int, userId)
        .query(`
            SELECT TOP 1 subscription_id, user_id, plan_name, start_date, end_date, status, renewal_type
            FROM dbo.subscription
            WHERE subscription_id = @subscriptionId AND user_id = @userId
        `);

    if (result.recordset.length === 0) {
        throw new ApiError(404, 'Subscription not found');
    }

    if (result.recordset[0].status === 'cancelled') {
        throw new ApiError(400, 'Subscription already cancelled');
    }

    await pool.request()
        .input('subscriptionId', sql.Int, subscriptionId)
        .input('userId', sql.Int, userId)
        .query(`
            UPDATE dbo.subscription
            SET status = 'cancelled'
            WHERE subscription_id = @subscriptionId AND user_id = @userId
        `);

    await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            UPDATE dbo.users
            SET subscription_end_date = (
                SELECT TOP 1 end_date
                FROM dbo.subscription
                WHERE user_id = @userId AND status = 'active'
                ORDER BY end_date DESC, subscription_id DESC
            )
            WHERE user_id = @userId
        `);

    return { cancelled: true };
};

module.exports = {
    getCurrentSubscription,
    listSubscriptions,
    createSubscription,
    cancelSubscription
};
