const { poolPromise, sql } = require('../src/config/db');

poolPromise.then(async pool => {
    // 1. Create coach_rating table
    await pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'coach_rating')
        CREATE TABLE dbo.coach_rating (
            rating_id       INT           NOT NULL PRIMARY KEY,
            user_id         INT           NOT NULL,
            coach_id        INT           NOT NULL,
            communication   TINYINT       NOT NULL CHECK (communication BETWEEN 1 AND 5),
            knowledge       TINYINT       NOT NULL CHECK (knowledge BETWEEN 1 AND 5),
            attitude        TINYINT       NOT NULL CHECK (attitude BETWEEN 1 AND 5),
            punctuality     TINYINT       NOT NULL CHECK (punctuality BETWEEN 1 AND 5),
            overall_avg     DECIMAL(3,2)  NOT NULL,
            comment         NVARCHAR(500) NULL,
            rated_at        DATETIME      NOT NULL DEFAULT GETDATE(),
            FOREIGN KEY (user_id)   REFERENCES dbo.users(user_id)   ON DELETE CASCADE,
            FOREIGN KEY (coach_id)  REFERENCES dbo.coach(coach_id)  ON DELETE CASCADE
        )
    `);
    console.log('✅ coach_rating table created');

    // 2. Add a test coach if none exist
    const coaches = await pool.request().query('SELECT coach_id, username FROM dbo.coach');
    if (coaches.recordset.length === 0) {
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash('coach123', 10);
        const nextId = (await pool.request().query('SELECT ISNULL(MAX(coach_id),0)+1 AS n FROM dbo.coach')).recordset[0].n;
        await pool.request()
            .input('id', sql.Int, nextId)
            .input('hash', sql.VarChar(255), hash)
            .query(`INSERT INTO dbo.coach (coach_id, username, email, password_hash, phone, status, created_at)
                    VALUES (@id, 'Coach Ali', 'ali@gym.com', @hash, '01000000001', 'active', GETDATE())`);

        const nextId2 = nextId + 1;
        await pool.request()
            .input('id', sql.Int, nextId2)
            .input('hash', sql.VarChar(255), hash)
            .query(`INSERT INTO dbo.coach (coach_id, username, email, password_hash, phone, status, created_at)
                    VALUES (@id, 'Coach Sara', 'sara@gym.com', @hash, '01000000002', 'active', GETDATE())`);
        console.log('✅ 2 demo coaches added (Coach Ali, Coach Sara)');
    } else {
        console.log('✅ Coaches already exist:', coaches.recordset.map(c => c.username));
    }

    // Verify
    const final = await pool.request().query('SELECT coach_id, username, email FROM dbo.coach');
    console.log('Final coaches:', JSON.stringify(final.recordset, null, 2));
}).catch(e => console.error('ERROR:', e.message)).finally(() => process.exit(0));
