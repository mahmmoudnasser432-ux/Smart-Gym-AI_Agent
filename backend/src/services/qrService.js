const { sql, poolPromise } = require('../config/db');
const ApiError = require('../utils/apiError');
const { withAllocatedIntId } = require('../utils/idAllocator');

const checkIn = async (userId, machineId = null) => {
    const pool = await poolPromise;
    const existing = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT TOP 1 att_id
            FROM dbo.attendance
            WHERE user_id = @userId AND check_out_time IS NULL
            ORDER BY check_in_time DESC
        `);

    if (existing.recordset.length > 0) {
        throw new ApiError(400, 'User already checked in');
    }

    const attendanceIdAllocation = await withAllocatedIntId(pool, 'dbo.attendance', 'att_id', 'attendanceId');
    await attendanceIdAllocation.bind(pool.request())
        .input('userId', sql.Int, userId)
        .input('machineId', sql.Int, machineId)
        .query(`
            INSERT INTO dbo.attendance (att_id, user_id, machine_id, check_in_time)
            VALUES (@attendanceId, @userId, @machineId, GETDATE())
        `);

    return { checkedIn: true };
};

const checkOut = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            UPDATE dbo.attendance
            SET check_out_time = GETDATE()
            OUTPUT INSERTED.att_id, INSERTED.check_in_time, INSERTED.check_out_time
            WHERE att_id = (
                SELECT TOP 1 att_id
                FROM dbo.attendance
                WHERE user_id = @userId AND check_out_time IS NULL
                ORDER BY check_in_time DESC
            )
        `);

    if (result.recordset.length === 0) {
        throw new ApiError(404, 'No active check-in found');
    }

    return result.recordset[0];
};

const getHistory = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT att_id, machine_id, check_in_time, check_out_time
            FROM dbo.attendance
            WHERE user_id = @userId
            ORDER BY check_in_time DESC
        `);

    return result.recordset;
};

module.exports = {
    checkIn,
    checkOut,
    getHistory
};
