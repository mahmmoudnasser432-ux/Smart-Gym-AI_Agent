const { poolPromise, sql } = require('../src/config/db');

poolPromise.then(async pool => {
    try {
        console.log('Creating dbo.inbox_message table...');
        await pool.request().query(`
            IF NOT EXISTS (
                SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME = 'inbox_message'
            )
            BEGIN
                CREATE TABLE dbo.inbox_message (
                    message_id   INT            NOT NULL PRIMARY KEY,
                    sender_id    INT            NOT NULL,
                    sender_type  VARCHAR(20)    NOT NULL,  -- 'admin' or 'user'
                    recipient_id INT            NOT NULL,  -- always the user_id
                    content      NVARCHAR(MAX)  NOT NULL,
                    sent_at      DATETIME       NOT NULL DEFAULT GETDATE(),
                    read_flag    BIT            NOT NULL DEFAULT 0,
                    FOREIGN KEY (recipient_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE
                )
            END
        `);
        console.log('Successfully created dbo.inbox_message table.');
    } catch (error) {
        console.error('Migration Error:', error.message);
    } finally {
        process.exit(0);
    }
});
