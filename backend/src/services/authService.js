const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql, poolPromise } = require('../config/db');
const ApiError = require('../utils/apiError');
const { withAllocatedIntId } = require('../utils/idAllocator');
const emailService = require('./emailService');

const roleConfig = {
    user: { table: 'dbo.users', idColumn: 'user_id' },
    coach: { table: 'dbo.coach', idColumn: 'coach_id' },
    admin: { table: 'dbo.admin', idColumn: 'admin_id' }
};

const createToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
const createRefreshToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });

const mapIdentity = (role, row) => ({
    id: row[roleConfig[role].idColumn],
    username: row.username,
    email: row.email,
    phone: row.phone,
    role,
    status: row.status,
    createdAt: row.created_at
});

const findIdentityByEmail = async (email, explicitRole) => {
    console.log(`[AUTH SERVICE] Searching for identity: ${email} (role: ${explicitRole || 'any'})`);
    const pool = await poolPromise;
    const roles = explicitRole ? [explicitRole] : ['user', 'coach', 'admin'];

    for (const role of roles) {
        const config = roleConfig[role];
        const result = await pool.request()
            .input('email', sql.VarChar, email)
            .query(`SELECT TOP 1 * FROM ${config.table} WHERE email = @email`);

        if (result.recordset.length > 0) {
            return { role, record: result.recordset[0] };
        }
    }

    return null;
};

const register = async ({ username, email, password, phone }) => {
    const existing = await findIdentityByEmail(email, 'user');
    if (existing) {
        throw new ApiError(409, 'Email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const userIdAllocation = await withAllocatedIntId(transaction, 'dbo.users', 'user_id', 'userId');
        const request = userIdAllocation.bind(new sql.Request(transaction));
        const userResult = await request
            .input('username', sql.VarChar, username)
            .input('email', sql.VarChar, email)
            .input('passwordHash', sql.VarChar, passwordHash)
            .input('phone', sql.VarChar, phone || null)
            .query(`
                INSERT INTO dbo.users (user_id, username, email, password_hash, phone, status)
                OUTPUT INSERTED.user_id, INSERTED.username, INSERTED.email, INSERTED.phone, INSERTED.status, INSERTED.created_at
                VALUES (@userId, @username, @email, @passwordHash, @phone, 'active')
            `);

        const user = userResult.recordset[0];

        const walletIdAllocation = await withAllocatedIntId(transaction, 'dbo.tokenwallet', 'wallet_id', 'walletId');
        await walletIdAllocation.bind(new sql.Request(transaction))
            .input('userId', sql.Int, user.user_id)
            .query(`
                IF NOT EXISTS (SELECT 1 FROM dbo.tokenwallet WHERE user_id = @userId)
                INSERT INTO dbo.tokenwallet (wallet_id, user_id, balance, updated_at)
                VALUES (@walletId, @userId, 0, GETDATE())
            `);

        await transaction.commit();

        const data = mapIdentity('user', user);
        return {
            user: data,
            token: createToken({ userId: data.id, role: 'user', email: data.email })
        };
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

const login = async ({ email: rawEmail, password, role: explicitRole }) => {
    // ─── Detect role from email prefix ──────────────────────────
    // admin:admin@gym.com  → role=admin, plain-text password
    // coach:coach@gym.com  → role=coach, plain-text password
    // normal@email.com     → role=user,  bcrypt password
    let detectedRole = explicitRole || null;
    let cleanEmail   = rawEmail ? rawEmail.trim() : '';

    if (cleanEmail.toLowerCase().startsWith('admin:')) {
        detectedRole = 'admin';
        cleanEmail   = cleanEmail.slice('admin:'.length).trim();
    } else if (cleanEmail.toLowerCase().startsWith('coach:')) {
        detectedRole = 'coach';
        cleanEmail   = cleanEmail.slice('coach:'.length).trim();
    } else {
        // no prefix provided - search across all roles
        detectedRole = detectedRole || null;
    }

    const identity = await findIdentityByEmail(cleanEmail, detectedRole);
    if (!identity) {
        console.error(`[AUTH LOGIN] ❌ No record found for email="${cleanEmail}" role="${detectedRole}"`);
        throw new ApiError(401, 'Invalid credentials');
    }
    console.log(`[AUTH LOGIN] ✅ Found identity role="${identity.role}" for email="${cleanEmail}"`);

    // ─── Password check ─────────────────────────────────────────
    // admin → column is 'password' (plain text, no hashing)
    // coach → column is 'password_hash' (plain text, no hashing)
    // user  → column is 'password_hash' (bcrypt hashed)
    const storedPassword = String(
        identity.record.password        // admin table
        ?? identity.record.password_hash // coach & user tables
        ?? ''
    );
    console.log(`[AUTH LOGIN] storedPassword resolved (first 10 chars): "${storedPassword.slice(0, 10)}..." | length=${storedPassword.length}`);

    let isValid = false;
    if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')) {
        isValid = await bcrypt.compare(password, storedPassword);
        console.log(`[AUTH LOGIN] bcrypt.compare result: isValid=${isValid}`);
    } else {
        isValid = password === storedPassword;
        console.log(`[AUTH LOGIN] Plain-text compare for role="${identity.role}": isValid=${isValid}`);
    }

    if (!isValid) {
        console.error(`[AUTH LOGIN] ❌ Password mismatch for email="${cleanEmail}"`);
        throw new ApiError(401, 'Invalid credentials');
    }

    const user    = mapIdentity(identity.role, identity.record);
    const payload = { userId: user.id, role: user.role, email: user.email };
    return {
        user,
        token:         createToken(payload),
        refresh_token: createRefreshToken(payload)
    };
};


const getProfile = async ({ userId, role }) => {
    const config = roleConfig[role];
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, userId)
        .query(`SELECT TOP 1 * FROM ${config.table} WHERE ${config.idColumn} = @id`);

    if (result.recordset.length === 0) {
        throw new ApiError(404, 'Profile not found');
    }

    return mapIdentity(role, result.recordset[0]);
};

const refreshToken = async ({ refreshToken: token }) => {
    if (!token) {
        throw new ApiError(400, 'Refresh token is required');
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (_) {
        throw new ApiError(401, 'Invalid or expired refresh token');
    }

    // Verify the user still exists
    const config = roleConfig[decoded.role];
    if (!config) {
        throw new ApiError(401, 'Invalid token payload');
    }

    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, decoded.userId)
        .query(`SELECT TOP 1 * FROM ${config.table} WHERE ${config.idColumn} = @id`);

    if (result.recordset.length === 0) {
        throw new ApiError(401, 'User no longer exists');
    }

    const user = mapIdentity(decoded.role, result.recordset[0]);
    const newPayload = { userId: user.id, role: user.role, email: user.email };

    return {
        user,
        token: createToken(newPayload),
        refresh_token: createRefreshToken(newPayload)
    };
};

const forgotPassword = async (email) => {
    const identity = await findIdentityByEmail(email, null);
    if (!identity) {
        // For security, don't reveal if email exists
        return { message: 'If this email exists, a code has been sent.' };
    }

    const config = roleConfig[identity.role];
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const pool = await poolPromise;
    await pool.request()
        .input('email', sql.VarChar, email)
        .input('code', sql.VarChar, code)
        .input('expiresAt', sql.DateTime, expiresAt)
        .query(`
            UPDATE ${config.table} 
            SET reset_code = @code, 
                reset_code_expires_at = @expiresAt 
            WHERE email = @email
        `);

    console.log(`[AUTH SERVICE] Generating code for ${email} (role: ${identity.role}): ${code}`);
    await emailService.sendResetCode(email, code);

    return { message: 'Reset code sent to your email' };
};

const verifyResetCode = async (email, code) => {
    const identity = await findIdentityByEmail(email, null);
    if (!identity) {
        throw new ApiError(404, 'User not found');
    }
    const config = roleConfig[identity.role];

    const pool = await poolPromise;
    const result = await pool.request()
        .input('email', sql.VarChar, email)
        .query(`
            SELECT reset_code, reset_code_expires_at
            FROM ${config.table}
            WHERE email = @email
        `);

    if (result.recordset.length === 0) {
        throw new ApiError(404, 'User not found');
    }

    const { reset_code, reset_code_expires_at } = result.recordset[0];

    if (!reset_code || reset_code !== String(code)) {
        throw new ApiError(400, 'Invalid verification code');
    }

    if (new Date() > new Date(reset_code_expires_at)) {
        throw new ApiError(400, 'Verification code has expired');
    }

    return { valid: true, message: 'Code verified successfully' };
};

const resetPassword = async (email, code, newPassword) => {
    const identity = await findIdentityByEmail(email, null);
    if (!identity) {
        throw new ApiError(404, 'User not found');
    }
    const config = roleConfig[identity.role];

    const pool = await poolPromise;
    const result = await pool.request()
        .input('email', sql.VarChar, email)
        .query(`
            SELECT reset_code, reset_code_expires_at 
            FROM ${config.table} 
            WHERE email = @email
        `);

    if (result.recordset.length === 0) {
        throw new ApiError(404, 'User not found');
    }

    const { reset_code, reset_code_expires_at } = result.recordset[0];

    if (!reset_code || reset_code !== code) {
        throw new ApiError(400, 'Invalid verification code');
    }

    if (new Date() > new Date(reset_code_expires_at)) {
        throw new ApiError(400, 'Verification code has expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const passwordColumn = identity.role === 'admin' ? 'password' : 'password_hash';
    const passwordVal = identity.role === 'admin' ? newPassword : passwordHash; // Admin uses plain text currently

    await pool.request()
        .input('email', sql.VarChar, email)
        .input('passwordVal', sql.VarChar, passwordVal)
        .query(`
            UPDATE ${config.table} 
            SET ${passwordColumn} = @passwordVal, 
                reset_code = NULL, 
                reset_code_expires_at = NULL 
            WHERE email = @email
        `);

    return { message: 'Password has been reset successfully' };
};

module.exports = {
    register,
    login,
    refreshToken,
    getProfile,
    forgotPassword,
    verifyResetCode,
    resetPassword
};
