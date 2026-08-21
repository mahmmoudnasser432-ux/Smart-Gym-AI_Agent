const { poolPromise, sql } = require('../src/config/db');

poolPromise.then(async pool => {
    // 1. Create chatmessage table
    await pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'chatmessage')
        CREATE TABLE dbo.chatmessage (
            message_id      INT           NOT NULL PRIMARY KEY,
            from_coach_id   INT           NOT NULL,
            to_user_id      INT           NOT NULL,
            content         NVARCHAR(MAX) NOT NULL,
            sent_at         DATETIME      NOT NULL DEFAULT GETDATE(),
            read_flag       BIT           NOT NULL DEFAULT 0,
            sender_type     VARCHAR(20)   NOT NULL,
            FOREIGN KEY (to_user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE,
            FOREIGN KEY (from_coach_id) REFERENCES dbo.coach(coach_id) ON DELETE CASCADE
        )
    `);
    console.log('✅ chatmessage table created or already exists');

}).catch(e => console.error('ERROR:', e.message)).finally(() => process.exit(0));
