const { sql, poolPromise } = require('../config/db');
const ApiError = require('../utils/apiError');
const { withAllocatedIntId } = require('../utils/idAllocator');

const getMachineById = async (pool, machineId) => {
    const result = await pool.request()
        .input('machineId', sql.Int, machineId)
        .query('SELECT TOP 1 * FROM dbo.machine WHERE machine_id = @machineId');
    return result.recordset[0] || null;
};

const parseDateOnly = (value) => {
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);

    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
    }

    return date;
};

const parseClockTime = (value) => {
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3] || 0);

    if (hours > 23 || minutes > 59 || seconds > 59) return null;
    return { hours, minutes, seconds };
};

const combineDateAndTime = (date, time) => {
    const combined = new Date(date);
    combined.setHours(time.hours, time.minutes, time.seconds, 0);
    return combined;
};

const parseBookingDateTime = ({ bookingDate, value, field }) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

    const clockTime = parseClockTime(value);
    if (clockTime) {
        const date = parseDateOnly(bookingDate);
        if (!date) throw new ApiError(400, 'bookingDate must be in YYYY-MM-DD format when using clock times');
        return combineDateAndTime(date, clockTime);
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new ApiError(400, `${field} must be a valid datetime or HH:mm time`);
    }

    return date;
};

const minutesBetween = (startTime, endTime) => Math.round((endTime.getTime() - startTime.getTime()) / 60000);

const toIsoDate = (date) => date.toISOString().slice(0, 10);

const getCurrentWeekBoundaries = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const offsetToSaturday = (dayOfWeek === 6) ? 0 : -(dayOfWeek + 1);
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + offsetToSaturday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return { startOfWeek, endOfWeek };
};

const buildBookingSummary = ({ booking, machine, durationMinutes }) => ({
    bookingId: booking.booking_id,
    machineId: machine.machine_id,
    machineName: machine.name,
    day: toIsoDate(new Date(booking.start_time)),
    from: booking.start_time,
    to: booking.end_time,
    durationMinutes,
    totalTokens: Number(booking.tokens_spent),
    status: booking.status
});

const resolveBookingWindow = ({ bookingDate, startTime, endTime, durationMinutes }) => {
    const start = parseBookingDateTime({ bookingDate, value: startTime, field: 'startTime' });
    let end;

    if (endTime != null) {
        end = parseBookingDateTime({ bookingDate, value: endTime, field: 'endTime' });
    } else {
        end = new Date(start.getTime() + Number(durationMinutes) * 60000);
    }

    const resolvedDuration = minutesBetween(start, end);
    if (resolvedDuration < 5 || resolvedDuration > 120) {
        throw new ApiError(400, 'Booking duration must be between 5 and 120 minutes');
    }

    if (end <= start) {
        throw new ApiError(400, 'endTime must be after startTime');
    }

    return { start, end, durationMinutes: resolvedDuration };
};

const listMachines = async () => {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT m.machine_id, m.name, m.location, m.status, m.tokens_required_per_minute, m.machine_count,
               CASE
                   WHEN (
                       SELECT COUNT(*)
                       FROM dbo.machinebooking b
                       WHERE b.machine_id = m.machine_id
                         AND b.status IN ('Booked', 'Active')
                         AND b.start_time <= GETDATE()
                         AND b.end_time > GETDATE()
                   ) >= ISNULL(m.machine_count, 1) THEN CAST(0 AS bit)
                   ELSE CAST(1 AS bit)
               END AS is_available
        FROM dbo.machine m
        ORDER BY m.machine_id ASC
    `);
    return result.recordset;
};

const listAvailableMachines = async () => {
    const machines = await listMachines();
    return machines.filter((machine) => machine.is_available);
};

const getBookedTimes = async (machineId, bookingDate) => {
    const pool = await poolPromise;
    const machine = await getMachineById(pool, machineId);

    if (!machine) {
        throw new ApiError(404, 'Machine not found');
    }

    const day = parseDateOnly(bookingDate);
    if (!day) {
        throw new ApiError(400, 'date must be in YYYY-MM-DD format');
    }

    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    const result = await pool.request()
        .input('machineId', sql.Int, machineId)
        .input('dayStart', sql.DateTime, day)
        .input('dayEnd', sql.DateTime, nextDay)
        .query(`
            SELECT booking_id, start_time, end_time, status
            FROM dbo.machinebooking
            WHERE machine_id = @machineId
              AND status IN ('Booked', 'Active')
              AND start_time < @dayEnd
              AND end_time > @dayStart
            ORDER BY start_time ASC, booking_id ASC
        `);

    return {
        machine: {
            machine_id: machine.machine_id,
            name: machine.name,
            machine_count: machine.machine_count
        },
        date: bookingDate,
        bookedTimes: result.recordset.map((booking) => ({
            bookingId: booking.booking_id,
            startTime: booking.start_time,
            endTime: booking.end_time,
            status: booking.status
        }))
    };
};

const bookMachine = async (userId, { machineId, bookingDate, startTime, endTime, durationMinutes }) => {
    const pool = await poolPromise;
    const machine = await getMachineById(pool, machineId);

    if (!machine) {
        throw new ApiError(404, 'Machine not found');
    }

    const bookingWindow = resolveBookingWindow({ bookingDate, startTime, endTime, durationMinutes });

    const { startOfWeek, endOfWeek } = getCurrentWeekBoundaries();
    if (bookingWindow.start < startOfWeek || bookingWindow.start > endOfWeek) {
        throw new ApiError(400, 'Bookings are only allowed within the current week (Saturday to Friday).');
    }

    const activeBookingResult = await pool.request()
        .input('userId', sql.Int, userId)
        .input('startTime', sql.DateTime, bookingWindow.start)
        .input('endTime', sql.DateTime, bookingWindow.end)
        .query(`
            SELECT COUNT(*) AS count 
            FROM dbo.machinebooking 
            WHERE user_id = @userId 
              AND status IN ('Booked', 'Active') 
              AND start_time < @endTime
              AND end_time > @startTime
        `);
    if (activeBookingResult.recordset[0].count > 0) {
        throw new ApiError(400, 'You already have an active booking at this time. You cannot book more than one machine at the same time.');
    }

    const overlappingBookings = await pool.request()
        .input('machineId', sql.Int, machineId)
        .input('startTime', sql.DateTime, bookingWindow.start)
        .input('endTime', sql.DateTime, bookingWindow.end)
        .query(`
            SELECT COUNT(*) AS booked_count
            FROM dbo.machinebooking
            WHERE machine_id = @machineId
              AND status IN ('Booked', 'Active')
              AND start_time < @endTime
              AND end_time > @startTime
        `);

    const bookedCount = Number(overlappingBookings.recordset[0].booked_count);
    if (bookedCount >= Number(machine.machine_count || 1)) {
        throw new ApiError(409, 'Selected time is already fully booked for this machine');
    }

    const tokensSpent = Number(machine.tokens_required_per_minute) * Number(bookingWindow.durationMinutes);
    const walletResult = await pool.request()
        .input('userId', sql.Int, userId)
        .query('SELECT TOP 1 wallet_id, balance FROM dbo.tokenwallet WHERE user_id = @userId');

    if (walletResult.recordset.length === 0) {
        throw new ApiError(404, 'Token wallet not found');
    }

    const wallet = walletResult.recordset[0];
    if (Number(wallet.balance) < tokensSpent) {
        throw new ApiError(400, 'Insufficient tokens. Please recharge your tokens.');
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const bookingIdAllocation = await withAllocatedIntId(transaction, 'dbo.machinebooking', 'booking_id', 'bookingId');
        const historyIdAllocation = await withAllocatedIntId(transaction, 'dbo.TokenHistory', 'th_id', 'historyId');
        const bookingResult = await bookingIdAllocation.bind(new sql.Request(transaction))
            .input('machineId', sql.Int, machineId)
            .input('userId', sql.Int, userId)
            .input('tokensSpent', sql.Decimal(10, 2), tokensSpent)
            .input('startTime', sql.DateTime, bookingWindow.start)
            .input('endTime', sql.DateTime, bookingWindow.end)
            .query(`
                INSERT INTO dbo.machinebooking (booking_id, machine_id, user_id, start_time, end_time, tokens_spent, status)
                OUTPUT INSERTED.booking_id, INSERTED.start_time, INSERTED.end_time, INSERTED.tokens_spent, INSERTED.status
                VALUES (@bookingId, @machineId, @userId, @startTime, @endTime, @tokensSpent, 'Booked')
            `);

        await new sql.Request(transaction)
            .input('userId', sql.Int, userId)
            .input('tokensSpent', sql.Decimal(10, 2), tokensSpent)
            .query(`
                UPDATE dbo.tokenwallet
                SET balance = balance - @tokensSpent,
                    updated_at = GETDATE()
                WHERE user_id = @userId
            `);

        await historyIdAllocation.bind(new sql.Request(transaction))
            .input('walletId', sql.Int, wallet.wallet_id)
            .input('amount', sql.Decimal(10, 2), tokensSpent)
            .query(`
                INSERT INTO dbo.TokenHistory (th_id, wallet_id, type, amount, created_at)
                VALUES (@historyId, @walletId, 'debit', @amount, GETDATE())
            `);

        await new sql.Request(transaction)
            .input('machineId', sql.Int, machineId)
            .query(`UPDATE dbo.machine SET status = 'Reserved' WHERE machine_id = @machineId`);

        const sessionIdAllocation = await withAllocatedIntId(transaction, 'dbo.machine_sessions', 'session_id', 'sessionId');
        const mhIdAllocation = await withAllocatedIntId(transaction, 'dbo.machine_history', 'mh_id', 'mhId');

        // Insert into machine_sessions
        const sessionResult = await sessionIdAllocation.bind(new sql.Request(transaction))
            .input('userId', sql.Int, userId)
            .input('machineId', sql.Int, machineId)
            .input('startTime', sql.DateTime, bookingWindow.start)
            .input('endTime', sql.DateTime, bookingWindow.end)
            .input('tokensSpent', sql.Decimal(10, 2), tokensSpent)
            .query(`
                INSERT INTO dbo.machine_sessions (session_id, user_id, machine_id, date, start_time, end_time, tokens_deducted)
                OUTPUT INSERTED.session_id
                VALUES (@sessionId, @userId, @machineId, @startTime, @startTime, @endTime, @tokensSpent)
            `);

        const sessionId = sessionResult.recordset[0].session_id;

        // Insert into machine_history
        await mhIdAllocation.bind(new sql.Request(transaction))
            .input('userId', sql.Int, userId)
            .input('machineId', sql.Int, machineId)
            .input('sessionId', sql.Int, sessionId)
            .query(`
                INSERT INTO dbo.machine_history (mh_id, user_id, machine_id, session_id, history_date)
                VALUES (@mhId, @userId, @machineId, @sessionId, GETDATE())
            `);

        await transaction.commit();
        const booking = bookingResult.recordset[0];
        return {
            machine,
            booking,
            bookingSummary: buildBookingSummary({
                booking,
                machine,
                durationMinutes: bookingWindow.durationMinutes
            })
        };
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

const cancelBooking = async (userId, bookingId) => {
    const pool = await poolPromise;
    const bookingResult = await pool.request()
        .input('bookingId', sql.Int, bookingId)
        .input('userId', sql.Int, userId)
        .query(`
            SELECT TOP 1 b.*, w.wallet_id
            FROM dbo.machinebooking b
            JOIN dbo.tokenwallet w ON w.user_id = b.user_id
            WHERE b.booking_id = @bookingId AND b.user_id = @userId
        `);

    if (bookingResult.recordset.length === 0) {
        throw new ApiError(404, 'Booking not found');
    }

    const booking = bookingResult.recordset[0];
    if (booking.status === 'Cancelled') {
        throw new ApiError(400, 'Booking already cancelled');
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const historyIdAllocation = await withAllocatedIntId(transaction, 'dbo.TokenHistory', 'th_id', 'historyId');
        await new sql.Request(transaction)
            .input('bookingId', sql.Int, bookingId)
            .query("UPDATE dbo.machinebooking SET status = 'Cancelled' WHERE booking_id = @bookingId");

        await new sql.Request(transaction)
            .input('userId', sql.Int, userId)
            .input('tokensSpent', sql.Decimal(10, 2), booking.tokens_spent)
            .query(`
                UPDATE dbo.tokenwallet
                SET balance = balance + @tokensSpent,
                    updated_at = GETDATE()
                WHERE user_id = @userId
            `);

        await historyIdAllocation.bind(new sql.Request(transaction))
            .input('walletId', sql.Int, booking.wallet_id)
            .input('amount', sql.Decimal(10, 2), booking.tokens_spent)
            .query(`
                INSERT INTO dbo.TokenHistory (th_id, wallet_id, type, amount, created_at)
                VALUES (@historyId, @walletId, 'refund', @amount, GETDATE())
            `);

        await new sql.Request(transaction)
            .input('machineId', sql.Int, booking.machine_id)
            .query("UPDATE dbo.machine SET status = 'Available' WHERE machine_id = @machineId");

        await transaction.commit();
        return { cancelled: true };
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

const getBookingHistory = async (userId) => {
    const pool = await poolPromise;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Delete machine_history records older than this month for this user
    await pool.request()
        .input('userId', sql.Int, userId)
        .input('startOfMonth', sql.DateTime, startOfMonth)
        .query(`
            DELETE FROM dbo.machine_history
            WHERE user_id = @userId
              AND history_date < @startOfMonth
        `);

    // Fetch this month's machine history
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .input('startOfMonth', sql.DateTime, startOfMonth)
        .query(`
            SELECT
                mh.mh_id,
                mh.history_date,
                m.machine_id,
                m.name,
                m.location,
                s.session_id,
                s.start_time,
                s.end_time,
                s.tokens_deducted  AS tokens_spent,
                ISNULL(b.status, 'Booked') AS status
            FROM dbo.machine_history mh
            JOIN dbo.machine          m ON m.machine_id  = mh.machine_id
            JOIN dbo.machine_sessions s ON s.session_id  = mh.session_id
            LEFT JOIN dbo.machinebooking b
                   ON b.user_id    = mh.user_id
                  AND b.machine_id = mh.machine_id
                  AND b.start_time = s.start_time
                  AND b.end_time   = s.end_time
            WHERE mh.user_id = @userId
              AND mh.history_date >= @startOfMonth
            ORDER BY mh.history_date DESC
        `);

    return result.recordset;
};

// ── NEW: Admin CRUD for machines ───────────────────────────────────────────────
const createMachine = async ({ name, location, tokensPerMinute, machineCount }) => {
    const pool = await poolPromise;
    const machineIdAllocation = await withAllocatedIntId(pool, 'dbo.machine', 'machine_id', 'machineId');
    const result = await machineIdAllocation.bind(pool.request())
        .input('name', sql.VarChar(100), name)
        .input('location', sql.VarChar(100), location || null)
        .input('tokensPerMinute', sql.Decimal(10, 2), Number(tokensPerMinute || 1))
        .input('machineCount', sql.Int, Number(machineCount || 1))
        .query(`
            INSERT INTO dbo.machine (machine_id, name, location, status, tokens_required_per_minute, machine_count)
            OUTPUT INSERTED.machine_id, INSERTED.name, INSERTED.location, INSERTED.status,
                   INSERTED.tokens_required_per_minute, INSERTED.machine_count
            VALUES (@machineId, @name, @location, 'Available', @tokensPerMinute, @machineCount)
        `);
    return result.recordset[0];
};

const updateMachine = async (machineId, { name, location, status, tokensPerMinute, machineCount }) => {
    const pool = await poolPromise;
    const current = await getMachineById(pool, machineId);
    if (!current) throw new ApiError(404, 'Machine not found');

    const result = await pool.request()
        .input('machineId', sql.Int, machineId)
        .input('name', sql.VarChar(100), name || current.name)
        .input('location', sql.VarChar(100), location ?? current.location)
        .input('status', sql.VarChar(20), status || current.status)
        .input('tokensPerMinute', sql.Decimal(10, 2), tokensPerMinute != null ? Number(tokensPerMinute) : current.tokens_required_per_minute)
        .input('machineCount', sql.Int, machineCount != null ? Number(machineCount) : current.machine_count)
        .query(`
            UPDATE dbo.machine
            SET name = @name,
                location = @location,
                status = @status,
                tokens_required_per_minute = @tokensPerMinute,
                machine_count = @machineCount
            OUTPUT INSERTED.machine_id, INSERTED.name, INSERTED.location, INSERTED.status,
                   INSERTED.tokens_required_per_minute, INSERTED.machine_count
            WHERE machine_id = @machineId
        `);
    return result.recordset[0];
};

const deleteMachine = async (machineId) => {
    const pool = await poolPromise;
    const current = await getMachineById(pool, machineId);
    if (!current) throw new ApiError(404, 'Machine not found');

    await pool.request()
        .input('machineId', sql.Int, machineId)
        .query('DELETE FROM dbo.machine WHERE machine_id = @machineId');
    return { deleted: true };
};

// ── NEW: Crowding snapshot ─────────────────────────────────────────────────────
const addCrowdSnapshot = async ({ machineId, gymZone, currentCount, capacityEstimate }) => {
    const pool = await poolPromise;
    const snapshotIdAllocation = await withAllocatedIntId(pool, 'dbo.crowding_snapshot', 'snapshot_id', 'snapshotId');
    const result = await snapshotIdAllocation.bind(pool.request())
        .input('machineId', sql.Int, machineId || null)
        .input('gymZone', sql.VarChar(50), gymZone || null)
        .input('currentCount', sql.Int, Number(currentCount || 0))
        .input('capacityEstimate', sql.Int, Number(capacityEstimate || 0))
        .query(`
            INSERT INTO dbo.crowding_snapshot (snapshot_id, machine_id, gym_zone, current_count, capacity_estimate, taken_at)
            OUTPUT INSERTED.snapshot_id, INSERTED.machine_id, INSERTED.gym_zone,
                   INSERTED.current_count, INSERTED.capacity_estimate, INSERTED.taken_at
            VALUES (@snapshotId, @machineId, @gymZone, @currentCount, @capacityEstimate, GETDATE())
        `);
    return result.recordset[0];
};

// ── NEW: All bookings (admin view) ─────────────────────────────────────────────
const listAllBookings = async () => {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT b.booking_id, b.user_id, b.machine_id, b.start_time, b.end_time,
               b.tokens_spent, b.status,
               u.username, u.email,
               m.name AS machine_name, m.location
        FROM dbo.machinebooking b
        JOIN dbo.users u ON u.user_id = b.user_id
        JOIN dbo.machine m ON m.machine_id = b.machine_id
        ORDER BY b.start_time DESC, b.booking_id DESC
    `);
    return result.recordset;
};

module.exports = {
    listMachines,
    listAvailableMachines,
    getBookedTimes,
    bookMachine,
    cancelBooking,
    getBookingHistory,
    createMachine,
    updateMachine,
    deleteMachine,
    addCrowdSnapshot,
    listAllBookings
};
