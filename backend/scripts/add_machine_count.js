const { poolPromise } = require('../DB.js');

async function run() {
    const pool = await poolPromise;
    await pool.request().query(`
        IF COL_LENGTH('dbo.machine', 'machine_count') IS NULL
        BEGIN
            ALTER TABLE dbo.machine
            ADD machine_count INT NOT NULL DEFAULT 1;
        END
    `);
    console.log('SUCCESS: Column machine_count is ready on dbo.machine');
}

run()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('FAILED:', error.message);
        process.exit(1);
    });
