const { sql, poolPromise } = require('../src/config/db');

poolPromise.then(async (pool) => {
    try {
        const check = await pool.request().query(
            "SELECT 1 AS found FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'chatmessage' AND COLUMN_NAME = 'sender_type'"
        );
        if (check.recordset.length > 0) {
            console.log('Column sender_type already exists — nothing to do.');
        } else {
            await pool.request().query(
                "ALTER TABLE dbo.chatmessage ADD sender_type VARCHAR(10) NOT NULL DEFAULT 'coach'"
            );
            console.log('SUCCESS: Column sender_type added to dbo.chatmessage');
        }

        await pool.request().query(
            "ALTER TABLE dbo.chatmessage ALTER COLUMN content NVARCHAR(MAX) NULL"
        );
        console.log('SUCCESS: Column content is NVARCHAR(MAX)');
    } catch (e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
}).catch((e) => {
    console.error('DB connection error:', e.message);
    process.exit(1);
});
