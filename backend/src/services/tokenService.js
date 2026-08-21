const { sql, poolPromise } = require('../config/db');
const { withAllocatedIntId } = require('../utils/idAllocator');

const ensureWallet = async (userId) => {
    const pool = await poolPromise;
    const walletIdAllocation = await withAllocatedIntId(pool, 'dbo.tokenwallet', 'wallet_id', 'walletId');
    await walletIdAllocation.bind(pool.request())
        .input('userId', sql.Int, userId)
        .query(`
            IF NOT EXISTS (SELECT 1 FROM dbo.tokenwallet WHERE user_id = @userId)
            INSERT INTO dbo.tokenwallet (wallet_id, user_id, balance, updated_at)
            VALUES (@walletId, @userId, 0, GETDATE())
        `);
};

const getBalance = async (userId) => {
    await ensureWallet(userId);
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query('SELECT TOP 1 wallet_id, user_id, balance, updated_at FROM dbo.tokenwallet WHERE user_id = @userId');

    return result.recordset[0];
};

const buyTokens = async (userId, { amount, method }) => {
    await ensureWallet(userId);
    const pool = await poolPromise;
    const wallet = await getBalance(userId);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const historyIdAllocation = await withAllocatedIntId(transaction, 'dbo.TokenHistory', 'th_id', 'historyId');
        const paymentIdAllocation = await withAllocatedIntId(transaction, 'dbo.payment', 'payment_id', 'paymentId');
        await new sql.Request(transaction)
            .input('userId', sql.Int, userId)
            .input('amount', sql.Decimal(10, 2), amount)
            .query(`
                UPDATE dbo.tokenwallet
                SET balance = balance + @amount,
                    updated_at = GETDATE()
                WHERE user_id = @userId
            `);

        await historyIdAllocation.bind(new sql.Request(transaction))
            .input('walletId', sql.Int, wallet.wallet_id)
            .input('amount', sql.Decimal(10, 2), amount)
            .query(`
                INSERT INTO dbo.TokenHistory (th_id, wallet_id, type, amount, created_at)
                VALUES (@historyId, @walletId, 'credit', @amount, GETDATE())
            `);

        await paymentIdAllocation.bind(new sql.Request(transaction))
            .input('userId', sql.Int, userId)
            .input('amount', sql.Decimal(10, 2), amount)
            .input('method', sql.VarChar, method || 'card')
            .query(`
                INSERT INTO dbo.payment (payment_id, user_id, subscription_id, amount, method, status, paid_at)
                VALUES (@paymentId, @userId, NULL, @amount, @method, 'paid', GETDATE())
            `);

        await transaction.commit();
        return getBalance(userId);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

const getHistory = async (userId) => {
    const wallet = await getBalance(userId);
    const pool = await poolPromise;
    const result = await pool.request()
        .input('walletId', sql.Int, wallet.wallet_id)
        .query(`
            SELECT th_id, type, amount, related_order_id, created_at
            FROM dbo.TokenHistory
            WHERE wallet_id = @walletId
            ORDER BY created_at DESC
        `);

    return result.recordset;
};

const getTokenAnalytics = async () => {
    const pool = await poolPromise;
    const result = await pool.request()
        .query(`
            SELECT
                m.name AS machine_name,
                ISNULL(SUM(mb.tokens_spent), 0) AS total_tokens
            FROM dbo.machinebooking mb
            JOIN dbo.machine m ON m.machine_id = mb.machine_id
            WHERE MONTH(mb.start_time) = MONTH(GETDATE())
              AND YEAR(mb.start_time) = YEAR(GETDATE())
            GROUP BY m.name
            ORDER BY total_tokens DESC
        `);
    return result.recordset;
};

module.exports = {
    getBalance,
    buyTokens,
    getHistory,
    getTokenAnalytics
};
